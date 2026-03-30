"""
obfuscator.py — v3 loader generator (fixed)

Fixes vs broken v3:
  - Header 'exeguard/1' → 'X-Exeguard':'1'  (slash in header name = 400 on Railway nginx)
  - IP source: loader now reads 'ip' from challenge response (session_ip),
    NOT from /api/myip — avoids Railway edge node mismatch between requests
  - /api/myip call removed (redundant + source of mismatch)
  - Part key uses same session_ip as proof
"""

import base64, os, random, string
from config import PUBLIC_BASE_URL


def _rn(n: int = 12) -> str:
    pfx = random.choice(["_x", "_q", "_z", "_O", "_l", "_r", "_w", "_p"])
    return pfx + "".join(random.choices(string.ascii_letters + string.digits, k=n))


def _xb(s: str) -> str:
    k = random.randint(0x21, 0xFD)
    enc = base64.b64encode(bytes(b ^ k for b in s.encode())).decode()
    return f"bytes(map(lambda _b,_k={k}:_b^_k,__import__('base64').b64decode({repr(enc)}))).decode()"


def _split(s: str) -> str:
    if len(s) <= 2:
        return repr(s)
    parts, i = [], 0
    while i < len(s):
        sz = random.randint(1, max(1, len(s) // 3))
        parts.append(repr(s[i:i+sz]))
        i += sz
    return "+".join(parts)


def _ints(s: str) -> str:
    return f"bytes({list(s.encode())}).decode()"


def _o(s: str) -> str:
    return random.choice([_xb, _ints, _split])(s)


def generate_loader(script_id: str, api_base: str = PUBLIC_BASE_URL, require_key: bool = False) -> str:
    api_base = api_base.rstrip("/")
    if not api_base.startswith("http"):
        api_base = "https://" + api_base

    # Randomized variable names
    n_chk  = _rn(); n_run  = _rn(); n_fp   = _rn()
    n_sid  = _rn(); n_base = _rn(); n_ts   = _rn()
    n_nc   = _rn(); n_prf  = _rn(); n_sk   = _rn()
    n_u1   = _rn(); n_u2   = _rn(); n_req  = _rn()
    n_bod  = _rn(); n_dat  = _rn(); n_dec  = _rn()
    n_raw  = _rn(); n_pc   = _rn(); n_buf  = _rn()
    n_i    = _rn(); n_pdat = _rn(); n_pkey = _rn()
    n_asm  = _rn(); n_ip   = _rn(); n_nv   = _rn()
    n_wipe = _rn()

    # Obfuscated literals
    sid_expr  = _o(script_id)
    base_expr = _o(api_base)
    path_ch   = _o("/api/challenge")
    path_ld   = _o("/api/load")

    # ✅ FIX 1: valid header name — no slash
    hdr_eg   = _o("X-Exeguard")   # header name
    val_eg   = _o("1")             # header value
    hdr_ts   = _o("X-Req-TS")
    hdr_ct   = _o("Content-Type")
    val_ct   = _o("application/json")

    k_nonce  = _o("nonce")
    k_pc     = _o("part_count")
    k_data   = _o("data")
    k_sid    = _o("sid")
    k_ts     = _o("ts")
    k_proof  = _o("proof")
    k_fp     = _o("fp")
    k_part   = _o("part")
    k_key    = _o("key")
    k_ip     = _o("ip")            # ✅ FIX 2: read ip from challenge response

    bad_mods  = _xb("pydevd,pdb,bdb,debugpy,ptvsd,ipdb,frida,rpdb,pydevd_tracing")
    comma_enc = _split(",")

    # Variable names for hidden module references
    n_sys  = _rn(); n_os   = _rn(); n_time = _rn()
    n_hash = _rn(); n_gc   = _rn(); n_hmac = _rn()
    n_b64  = _rn(); n_json = _rn(); n_urq  = _rn()
    n_ag   = _rn()

    # Obfuscated module name strings
    m_sys  = _o("sys");   m_os   = _o("os");   m_time = _o("time")
    m_hash = _o("hashlib"); m_gc = _o("gc");   m_hmac = _o("hmac")
    m_b64  = _o("base64"); m_json = _o("json")
    m_urq  = _o("urllib.request")
    m_crypt= _o("cryptography.hazmat.primitives.ciphers.aead")
    m_ag   = _o("AESGCM")

    lines = []

    # ── Imports (fully hidden via __import__) ─────────────────────────────────
    lines += [
        f"{n_sys}=__import__({m_sys})",
        f"{n_os}=__import__({m_os})",
        f"{n_time}=__import__({m_time})",
        f"{n_hash}=__import__({m_hash})",
        f"{n_gc}=__import__({m_gc})",
        f"{n_hmac}=__import__({m_hmac})",
        f"{n_b64}=__import__({m_b64})",
        f"{n_json}=__import__({m_json})",
        f"{n_urq}=__import__({m_urq},fromlist=['Request','urlopen'])",
        f"{n_ag}=getattr(__import__({m_crypt},fromlist=[{m_ag}]),{m_ag})",
        "",
    ]

    # Anti-debug: fresh hidden imports inside check function
    n_sx  = _rn(); n_tx = _rn(); n_ins = _rn(); n_bt = _rn()
    m_ins = _o("inspect"); m_bt = _o("builtins"); m_urq2 = _o("urllib.request"); m_hc = _o("http.client")
    m_tm  = _o("tracemalloc"); m_hcc = _o("HTTPConnection")

    # ── Memory wipe helper ────────────────────────────────────────────────────
    lines += [
        f"def {n_wipe}(buf):",
        "    try:",
        "        if isinstance(buf,bytearray):",
        "            for _wi in range(len(buf)): buf[_wi]=0",
        "        elif isinstance(buf,(bytes,str)):",
        "            _ba=bytearray(buf if isinstance(buf,bytes) else buf.encode())",
        "            for _wi in range(len(_ba)): _ba[_wi]=0",
        "            del _ba",
        "    except Exception: pass",
        f"    {n_gc}.collect()",
        "",
    ]

    # ── Anti-debug / self-destruct ────────────────────────────────────────────
    lines += [
        f"def {n_chk}():",
        f"    {n_sx}=__import__({m_sys})",
        f"    {n_tx}=__import__({m_time})",
        f"    {n_ins}=__import__({m_ins})",
        f"    {n_bt}=__import__({m_bt})",
        f"    if {n_sx}.gettrace() is not None: {n_sx}.exit(1)",
        f"    if {n_sx}.getprofile() is not None: {n_sx}.exit(1)",
        f"    _bad=set(({bad_mods}).split({comma_enc}))",
        f"    if _bad & set({n_sx}.modules): {n_sx}.exit(1)",
        f"    _u2=__import__({m_urq2},fromlist=[{_o('Request')}])",
        f"    _hc=__import__({m_hc},fromlist=[{m_hcc}])",
        f"    if _u2.Request.__module__!={_split('urllib.request')}: {n_sx}.exit(1)",
        f"    if _hc.HTTPConnection.__module__!={_split('http.client')}: {n_sx}.exit(1)",
        f"    if not isinstance(getattr({n_bt},{_o('exec')},None),type(len)): {n_sx}.exit(1)",
        f"    if not isinstance(getattr({n_bt},{_o('compile')},None),type(len)): {n_sx}.exit(1)",
        "    try:",
        f"        _tm=__import__({m_tm})",
        f"        if _tm.is_tracing(): {n_sx}.exit(1)",
        "    except ImportError: pass",
        f"    _t0={n_tx}.perf_counter()",
        "    _dd=sum(range(4000))",
        f"    if {n_tx}.perf_counter()-_t0>1.0: {n_sx}.exit(1)",
        f"    for _fi in {n_ins}.stack():",
        "        _fn=_fi.filename.lower()",
        "        for _bf in ('pydevd','debugpy','pdb','bdb','frida','rpdb'):",
        f"            if _bf in _fn: {n_sx}.exit(1)",
        "",
    ]

    # ── AES-GCM decrypt helper ────────────────────────────────────────────────
    lines += [
        f"def {n_dec}(_tok,_key):",
        f"    {n_raw}={n_b64}.urlsafe_b64decode(_tok.encode())",
        f"    return {n_ag}(_key).decrypt({n_raw}[:12],{n_raw}[12:],None)",
        "",
    ]

    # ── Main run ──────────────────────────────────────────────────────────────
    # Obfuscated sub-module names for fingerprint
    m_uuid   = _o("uuid"); m_sock = _o("socket")

    # Key input variable
    n_key = _rn()
    key_prompt = _o("Enter key: ") if require_key else None

    lines += [
        f"def {n_run}():",
        f"    {n_chk}()",
        f"    {n_sid}={sid_expr}",
        f"    {n_base}={base_expr}",

        # Fingerprint — already uses __import__, just keep var names clean
        "    try:",
        f"        _fp_r=f\"{{__import__({m_uuid}).getnode()}}:{{__import__({m_os}).cpu_count()}}:{{__import__({m_sock}).gethostname()}}\"",
        f"        {n_fp}={n_hash}.sha256(_fp_r.encode()).hexdigest()[:24]",
        "    except Exception:",
        f"        {n_fp}='x'",
    ]

    # Key prompt (only if project requires key)
    if require_key:
        lines += [
            f"    {n_key}=input({key_prompt}).strip()",
            f"    if not {n_key}: {n_sys}.exit(1)",
        ]
    else:
        lines += [
            f"    {n_key}=''",
        ]
        
    lines += [
        f"    {n_ts}=int({n_time}.time())",
        "",

        "    # ── Step 1: challenge ──────────────────────────────────────────────",
        f"    {n_u1}=f'{{{n_base}}}{{{path_ch}}}?sid={{{n_sid}}}'",
        "    try:",
        f"        {n_req}={n_urq}.Request({n_u1},headers={{{hdr_eg}:{val_eg},{hdr_ts}:str({n_ts})}})",
        f"        with {n_urq}.urlopen({n_req},timeout=10) as _r:",
        f"            {n_bod}={n_json}.loads(_r.read())",
        f"        {n_nc}={n_bod}[{k_pc}]",
        f"        {n_nv}={n_bod}[{k_nonce}]",
        f"        {n_ip}={n_bod}.get({k_ip},'unknown')",
        f"    except Exception: {n_sys}.exit(1)",
        f"    {n_chk}()",
        "",

        "    # ── Step 2: IP-bound proof ─────────────────────────────────────────",
        f"    {n_sk}={n_hash}.sha256(f'{{{n_sid}}}:{{{n_ts}}}:{{{n_ip}}}'.encode()).digest()",
        f"    {n_prf}={n_hmac}.new({n_sk},f'{{{n_nv}}}'.encode(),{n_hash}.sha256).hexdigest()",
        "",

        "    # ── Step 3: fetch all parts sequentially ──────────────────────────",
        f"    {n_pc}={n_nc}",
        f"    {n_asm}=[]",
        f"    {n_u2}=f'{{{n_base}}}{{{path_ld}}}'",
        f"    for {n_i} in range({n_pc}):",
        f"        {n_dat}={n_json}.dumps({{{k_sid}:{n_sid},{k_ts}:{n_ts},{k_nonce}:{n_nv},{k_proof}:{n_prf},{k_fp}:{n_fp},{k_part}:{n_i},{k_key}:{n_key}}}).encode()",
        "        try:",
        f"            {n_req}={n_urq}.Request({n_u2},{n_dat},headers={{{hdr_eg}:{val_eg},{hdr_ts}:str({n_ts}),{hdr_ct}:{val_ct}}})",
        f"            with {n_urq}.urlopen({n_req},timeout=12) as _r:",
        f"                {n_bod}={n_json}.loads(_r.read())",
        f"        except Exception: {n_sys}.exit(1)",
        f"        {n_chk}()",
        f"        if {k_data} not in {n_bod}: {n_sys}.exit(1)",
        f"        {n_pkey}={n_hash}.sha256(f'{{{n_sid}}}:{{{n_ts}}}:{{{n_nv}}}:{{{n_ip}}}:{{{n_i}}}'.encode()).digest()",
        f"        {n_pdat}={n_dec}({n_bod}[{k_data}],{n_pkey})",
        f"        {n_asm}.append(bytes({n_pdat}))",
        f"        {n_wipe}({n_pdat})",
        f"        del {n_pdat},{n_pkey}",
        f"        {n_gc}.collect()",
        "",

        "    # ── Step 4: assemble + exec + wipe ────────────────────────────────",
        f"    {n_buf}=b''.join({n_asm})",
        f"    for _pi in range(len({n_asm})): {n_asm}[_pi]=b''",
        f"    del {n_asm}",
        f"    {n_gc}.collect()",
        f"    {n_chk}()",
        "    try:",
        f"        _code=compile({n_buf}.decode(),'<p>','exec')",
        f"        {n_wipe}({n_buf})",
        f"        del {n_buf}",
        f"        {n_gc}.collect()",
        "        exec(_code,{'__name__':'__main__','__builtins__':__builtins__})",
        "        del _code",
        "    except SystemExit: raise",
        f"    except Exception: {n_sys}.exit(1)",
        "",
        f"{n_run}()",
    ]

    return "\n".join(lines) + "\n"
