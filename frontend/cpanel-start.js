/**
 * cpanel-start.js
 * Entry point cho cPanel Node.js Selector (Phusion Passenger).
 * Đặt file này ngang với server.js trong thư mục standalone.
 * Nếu cPanel yêu cầu startup file khác server.js, dùng file này.
 */

// Đảm bảo Next.js bind đúng host/port mà cPanel cung cấp
process.env.HOSTNAME = process.env.HOSTNAME || '0.0.0.0';
process.env.PORT     = process.env.PORT     || '3000';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Load Next.js standalone server
require('./server.js');
