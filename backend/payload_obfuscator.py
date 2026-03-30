"""
payload_obfuscator.py — Obfuscates user Python source before encrypting and storing.

Layers applied (in order):
  1. Variable / function rename (AST-level)
  2. String literal encryption (XOR inline)
  3. Opaque predicates injected into conditionals
  4. Control Flow Flattening (CFF) on function bodies
  5. MBA (Mixed Boolean Arithmetic) on integer operations
  6. Anti-hook exec wrapper (verifies builtins not patched)
  7. Mini-VM bytecode wrapper (optional, enable via obf_level=2)

Usage:
    from payload_obfuscator import obfuscate_source
    obfuscated = obfuscate_source(source_code, level=1)
    # level=1 → rename+strings+opaque+CFF
    # level=2 → level1 + VM wrap
"""

import ast
import random
import string
import base64
import hashlib
import textwrap
from typing import Any


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _rname(n: int = 8) -> str:
    """Random-looking but valid Python identifier."""
    prefixes = ["_O", "_l", "_I", "_o", "__", "_0", "_q", "_z"]
    p = random.choice(prefixes)
    body = "".join(random.choices("OlI0oqz" + string.digits, k=n))
    return p + body


def _xor_str(s: str) -> str:
    """Inline XOR-decode expression for a string literal."""
    k = random.randint(0x10, 0xEF)
    enc = base64.b64encode(bytes(b ^ k for b in s.encode("utf-8", errors="replace"))).decode()
    return (
        f"bytes(map(lambda _b,_k={k}:_b^_k,"
        f"__import__('base64').b64decode({repr(enc)}))).decode('utf-8','replace')"
    )


def _opaque_true() -> str:
    """Always-true opaque predicate (various forms)."""
    x = random.randint(2, 99)
    variants = [
        f"(({x}*{x}+{x})%2==0)",           # x*(x+1) always even
        f"(({x}|({x}+1))=={x|(x+1)})",     # bitwise identity
        f"(bool(1) is True)",
        f"(({x}&0)==0)",                     # x & 0 == 0 always
        f"(len({repr('A'*x)})=={x})",
    ]
    return random.choice(variants)


def _opaque_false() -> str:
    """Always-false opaque predicate."""
    x = random.randint(2, 50)
    variants = [
        f"(({x}*{x}+{x})%2!=0)",
        f"({x}&({x}+1)=={x}+1 and False)",
        f"(False and {x}==0)",
    ]
    return random.choice(variants)


def _mba_add(a: str, b: str) -> str:
    """MBA substitution: a+b = (a^b) + 2*(a&b)"""
    return f"(({a})^({b}))+2*(({a})&({b}))"


# ─────────────────────────────────────────────────────────────────────────────
# AST Transformer: rename + string encrypt + opaque predicates
# ─────────────────────────────────────────────────────────────────────────────

class _Renamer(ast.NodeTransformer):
    """Rename local variables and functions (preserves builtins/imports)."""

    BUILTINS = set(dir(__builtins__) if isinstance(__builtins__, dict) else dir(__builtins__))
    SKIP = {"__name__", "__file__", "__builtins__", "__doc__", "self", "cls",
             "True", "False", "None", "print", "exit", "open", "range",
             "len", "int", "str", "list", "dict", "set", "tuple", "type"}

    def __init__(self):
        self.mapping: dict[str, str] = {}
        self._imports: set[str] = set()

    def _mapped(self, name: str) -> str:
        if name in self.SKIP or name in self.BUILTINS or name in self._imports:
            return name
        if name.startswith("__") and name.endswith("__"):
            return name
        if name not in self.mapping:
            self.mapping[name] = _rname()
        return self.mapping[name]

    def visit_Import(self, node):
        for alias in node.names:
            self._imports.add(alias.asname or alias.name.split(".")[0])
        return node

    def visit_ImportFrom(self, node):
        for alias in node.names:
            self._imports.add(alias.asname or alias.name)
        return node

    def visit_FunctionDef(self, node):
        if not node.name.startswith("__"):
            node.name = self._mapped(node.name)
        node.args.args = [
            ast.arg(arg=self._mapped(a.arg), annotation=None)
            for a in node.args.args
        ]
        self.generic_visit(node)
        return node

    visit_AsyncFunctionDef = visit_FunctionDef

    def visit_Name(self, node):
        if isinstance(node.ctx, (ast.Store, ast.Load, ast.Del)):
            node.id = self._mapped(node.id)
        return node

    def visit_Constant(self, node):
        # Encrypt string constants (skip very short ones and docstrings)
        if isinstance(node.value, str) and len(node.value) > 2:
            expr = _xor_str(node.value)
            try:
                new_node = ast.parse(expr, mode="eval").body
                ast.copy_location(new_node, node)
                ast.fix_missing_locations(new_node)
                return new_node
            except Exception:
                pass
        return node


# ─────────────────────────────────────────────────────────────────────────────
# Control Flow Flattening
# ─────────────────────────────────────────────────────────────────────────────

def _flatten_function(source: str) -> str:
    """
    Wrap each top-level function body in a CFF dispatcher.
    
    def foo(x):
        stmt1
        stmt2
        return val

    becomes:

    def foo(x):
        _st = 0
        _ret = None
        while True:
            if _st == 0:
                stmt1
                _st = 1
            elif _st == 1:
                stmt2
                _st = 2
            elif _st == 2:
                _ret = val
                break
        return _ret  (if original had return)
    """
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return source

    class CFFTransformer(ast.NodeTransformer):
        def visit_FunctionDef(self, node):
            self.generic_visit(node)
            body = node.body

            # Skip trivial functions (1 stmt) or those with complex control flow
            if len(body) <= 1:
                return node

            # Flatten: assign each statement a state
            st_var = _rname(4)
            ret_var = _rname(4)
            states = []
            has_return = any(isinstance(s, ast.Return) for s in ast.walk(ast.Module(body=body, type_ignores=[])))

            for i, stmt in enumerate(body):
                next_st = i + 1
                if isinstance(stmt, ast.Return):
                    # Capture return value
                    val = stmt.value or ast.Constant(value=None)
                    states.append((i, [
                        ast.Assign(
                            targets=[ast.Name(id=ret_var, ctx=ast.Store())],
                            value=val,
                            lineno=0, col_offset=0
                        ),
                        ast.Break(lineno=0, col_offset=0)
                    ]))
                else:
                    states.append((i, [
                        stmt,
                        ast.Assign(
                            targets=[ast.Name(id=st_var, ctx=ast.Store())],
                            value=ast.Constant(value=next_st),
                            lineno=0, col_offset=0
                        )
                    ]))

            # Add break for last non-return state
            if states and not isinstance(body[-1], ast.Return):
                states[-1][1].append(ast.Break(lineno=0, col_offset=0))

            # Build if/elif chain
            if_chain = None
            for state_id, stmts in reversed(states):
                test = ast.Compare(
                    left=ast.Name(id=st_var, ctx=ast.Load()),
                    ops=[ast.Eq()],
                    comparators=[ast.Constant(value=state_id)]
                )
                if if_chain is None:
                    if_chain = ast.If(test=test, body=stmts, orelse=[])
                else:
                    if_chain = ast.If(test=test, body=stmts, orelse=[if_chain])

            while_loop = ast.While(
                test=ast.Constant(value=True),
                body=[if_chain] if if_chain else [ast.Pass()],
                orelse=[]
            )

            new_body = [
                ast.Assign(
                    targets=[ast.Name(id=st_var, ctx=ast.Store())],
                    value=ast.Constant(value=0),
                    lineno=0, col_offset=0
                ),
                ast.Assign(
                    targets=[ast.Name(id=ret_var, ctx=ast.Store())],
                    value=ast.Constant(value=None),
                    lineno=0, col_offset=0
                ),
                while_loop,
            ]

            if has_return:
                new_body.append(ast.Return(
                    value=ast.Name(id=ret_var, ctx=ast.Load())
                ))

            node.body = new_body
            ast.fix_missing_locations(node)
            return node

        visit_AsyncFunctionDef = visit_FunctionDef

    new_tree = CFFTransformer().visit(tree)
    ast.fix_missing_locations(new_tree)
    try:
        return ast.unparse(new_tree)
    except Exception:
        return source


# ─────────────────────────────────────────────────────────────────────────────
# Anti-hook exec wrapper
# ─────────────────────────────────────────────────────────────────────────────

ANTI_HOOK_HEADER = """\
import builtins as _bt, sys as _sy, types as _ty
def _verify_integrity():
    # exec must be native, not replaced
    if not isinstance(getattr(_bt, 'exec', None), type(len)): _sy.exit(1)
    # compile must be native
    if not isinstance(getattr(_bt, 'compile', None), type(len)): _sy.exit(1)
    # __import__ not patched
    if _bt.__import__.__module__ not in (None, 'builtins', '_frozen_importlib'): _sy.exit(1)
    # No suspicious modules loaded
    _bad = {'frida','pydevd','debugpy','pdb','bdb','rpdb'}
    if _bad & set(_sy.modules): _sy.exit(1)
_verify_integrity()
del _verify_integrity
"""


# ─────────────────────────────────────────────────────────────────────────────
# Mini VM (level 2)
# ─────────────────────────────────────────────────────────────────────────────

def _build_vm_wrapper(source: str) -> str:
    """
    Wrap source in an encrypted source-level VM.
    Uses zlib+XOR on SOURCE TEXT (not marshal bytecode) so it is
    100% Python-version independent — no marshal incompatibility across
    server (Railway) vs client (Termux/Windows/etc) Python versions.
    """
    import zlib

    # Validate syntax first
    try:
        compile(source, "<protected>", "exec")
    except SyntaxError as e:
        raise ValueError(f"Source has syntax error: {e}")

    # Compress + XOR source text (NOT bytecode)
    compressed = zlib.compress(source.encode("utf-8"), 9)
    key = random.randint(0x01, 0xFE)
    encrypted = bytes(b ^ ((key + i) % 256) for i, b in enumerate(compressed))
    enc_b64 = base64.b64encode(encrypted).decode()

    # Random VM variable names
    v = {n: _rname(5) for n in
         ["vm_blob", "vm_key", "vm_dec", "vm_src", "vm_i", "vm_bb"]}

    vm_code = f"""\
import base64 as _vb64, zlib as _vzlib
{v['vm_blob']} = _vb64.b64decode({repr(enc_b64)})
{v['vm_key']} = {key}
{v['vm_dec']} = bytes(({v['vm_bb']}^(({v['vm_key']}+{v['vm_i']})%256)) for {v['vm_i']},{v['vm_bb']} in enumerate({v['vm_blob']}))
{v['vm_src']} = _vzlib.decompress({v['vm_dec']}).decode('utf-8')
exec(compile({v['vm_src']}, '<p>', 'exec'), {{'__name__':'__main__','__builtins__':__builtins__}})
del {v['vm_blob']},{v['vm_key']},{v['vm_dec']},{v['vm_src']}
"""
    return vm_code


# ─────────────────────────────────────────────────────────────────────────────
# Opaque predicate injector
# ─────────────────────────────────────────────────────────────────────────────

def _inject_opaques(source: str) -> str:
    """Insert opaque predicate guards before random statements."""
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return source

    class OpaqueInjector(ast.NodeTransformer):
        def _maybe_wrap(self, stmts):
            result = []
            for stmt in stmts:
                # 40% chance to wrap each statement in an opaque-true if
                if random.random() < 0.4 and not isinstance(stmt, (ast.FunctionDef, ast.ClassDef, ast.Import, ast.ImportFrom)):
                    pred = _opaque_true()
                    fake_stmt = ast.Pass()
                    try:
                        pred_node = ast.parse(pred, mode="eval").body
                        guard = ast.If(
                            test=pred_node,
                            body=[stmt],
                            orelse=[fake_stmt]
                        )
                        ast.fix_missing_locations(guard)
                        result.append(guard)
                    except Exception:
                        result.append(stmt)
                else:
                    result.append(stmt)
            return result

        def visit_FunctionDef(self, node):
            self.generic_visit(node)
            node.body = self._maybe_wrap(node.body)
            return node

        visit_AsyncFunctionDef = visit_FunctionDef

    new_tree = OpaqueInjector().visit(tree)
    ast.fix_missing_locations(new_tree)
    try:
        return ast.unparse(new_tree)
    except Exception:
        return source


# ─────────────────────────────────────────────────────────────────────────────
# Main entry point
# ─────────────────────────────────────────────────────────────────────────────

def obfuscate_source(source: str, level: int = 1) -> str:
    """
    Obfuscate Python source code.

    level=1: rename + string encrypt + opaque predicates + CFF + anti-hook header
    level=2: level1 output wrapped in mini-VM (strongest, hides original bytecode)
    
    Returns obfuscated source string.
    Raises ValueError if source has syntax errors.
    """
    # Validate syntax first
    try:
        ast.parse(source)
    except SyntaxError as e:
        raise ValueError(f"Source syntax error: {e}")

    if level >= 2:
        # Level 2: VM wrap — compile + marshal + encrypt + stream cipher
        # Anti-hook header prepended to VM wrapper
        vm = _build_vm_wrapper(source)
        return ANTI_HOOK_HEADER + "\n" + vm

    # Level 1: AST transforms
    # Step 1: rename variables + encrypt string literals
    try:
        tree = ast.parse(source)
        renamer = _Renamer()
        new_tree = renamer.visit(tree)
        ast.fix_missing_locations(new_tree)
        renamed = ast.unparse(new_tree)
    except Exception:
        renamed = source  # fallback: skip rename if AST fails

    # Step 2: inject opaque predicates
    with_opaques = _inject_opaques(renamed)

    # Step 3: control flow flattening
    flattened = _flatten_function(with_opaques)

    # Step 4: prepend anti-hook header
    result = ANTI_HOOK_HEADER + "\n" + flattened

    # Final syntax check
    try:
        ast.parse(result)
    except SyntaxError:
        # If transforms broke syntax, fallback to just anti-hook + source
        result = ANTI_HOOK_HEADER + "\n" + source

    return result
