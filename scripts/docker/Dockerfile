# Dockerfile per HACCP App
FROM node:20-alpine AS builder

# Installa dipendenze di sistema
RUN apk add --no-cache git

# Crea directory di lavoro
WORKDIR /app

# Copia package.json e package-lock.json
COPY package*.json ./

# Installa dipendenze
RUN npm ci --only=production --silent

# Copia il codice sorgente
COPY . .

# Build dell'applicazione
RUN npm run build

# Stage di produzione
FROM nginx:alpine

# Installa curl per health checks
RUN apk add --no-cache curl

# Copia build dell'applicazione
COPY --from=builder /app/dist /usr/share/nginx/html

# Copia configurazione Nginx personalizzata
COPY scripts/docker/nginx.conf /etc/nginx/conf.d/default.conf

# Crea utente non-root per sicurezza
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

# Configurazione sicurezza Nginx
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Espone porta 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

# Avvia Nginx
CMD ["nginx", "-g", "daemon off;"]