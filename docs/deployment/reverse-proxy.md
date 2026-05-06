# Reverse Proxy Setup

BlindPass runs a single container (`webapp`) that listens on port **8000** over plain HTTP. The webapp's internal nginx handles both static file serving and API proxying to the backend — no separate proxy rules are needed for API routes.

Your reverse proxy job: terminate TLS and forward everything to `localhost:8000`.

## Before you start

After you know your domain, update `.env`:

```env
CORS_ORIGIN=https://yourdomain.com
COOKIE_DOMAIN=yourdomain.com
```

Then restart the stack:

```bash
docker compose up -d
```

---

## Caddy

Caddy provisions and renews TLS certificates automatically via Let's Encrypt. No cert management required.

**Install:** https://caddyserver.com/docs/install

Create or edit `/etc/caddy/Caddyfile`:

```
yourdomain.com {
    reverse_proxy localhost:8000
}
```

Reload:

```bash
systemctl reload caddy
```

That's it. Caddy handles HTTPS, HTTP→HTTPS redirect, and certificate renewal automatically.

---

## nginx

nginx requires manual certificate provisioning. The example below uses Certbot with Let's Encrypt.

**Install Certbot:** https://certbot.eff.org/instructions

Obtain a certificate:

```bash
certbot certonly --standalone -d yourdomain.com
```

Create `/etc/nginx/sites-available/blindpass`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and reload:

```bash
ln -s /etc/nginx/sites-available/blindpass /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

Certbot installs a cron job that auto-renews certificates. Verify it runs a reload hook:

```bash
certbot renew --deploy-hook "systemctl reload nginx" --dry-run
```
