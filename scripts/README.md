# 🚀 Installazione Tracker HACCP su Raspberry Pi

Guida completa per installare l'applicazione con PocketBase.

---

## 📦 Metodo 1: Installazione Automatica (con GitHub)

### Requisiti
- Raspberry Pi 3/4/5 con Raspberry Pi OS (64-bit consigliato)
- Connessione internet
- Almeno 2GB RAM, 8GB storage

### Installazione

```bash
# Scarica lo script
curl -O https://raw.githubusercontent.com/tuouser/tracker-haccp/main/scripts/install-haccp-pocketbase.sh

# Rendi eseguibile e avvia
chmod +x install-haccp-pocketbase.sh
sudo ./install-haccp-pocketbase.sh
```

---

## 🔧 Metodo 2: Installazione Manuale OFFLINE (senza GitHub)

Ideale per ambienti senza internet o per controllo totale.

### Passo 1: Prepara i file su un PC

Sul tuo PC con internet, scarica:

1. **PocketBase** da https://pocketbase.io/docs/
   - `pocketbase_X.X.X_linux_arm64.zip` per Pi 64-bit
   - `pocketbase_X.X.X_linux_armv7.zip` per Pi 32-bit

2. **Compila l'app React**:
   ```bash
   npm install
   npm run build
   ```

3. **Copia su chiavetta USB**:
   ```
   USB/
   ├── pocketbase_linux_arm64.zip
   ├── dist/                    ← cartella app compilata
   └── pb_schema.json          ← da scripts/pocketbase/
   ```

### Passo 2: Installa dipendenze sul Raspberry Pi

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx openssl avahi-daemon unzip
```

### Passo 3: Copia i file dalla USB

```bash
# Monta USB
sudo mount /dev/sda1 /mnt

# Crea cartelle
sudo mkdir -p /opt/haccp-app/{bin,data,web}

# Copia PocketBase
sudo unzip /mnt/pocketbase_linux_arm64.zip -d /opt/haccp-app/bin/
sudo chmod +x /opt/haccp-app/bin/pocketbase

# Copia app web
sudo cp -r /mnt/dist/* /opt/haccp-app/web/

# Smonta USB
sudo umount /mnt
```

### Passo 4: Configura servizio PocketBase

```bash
sudo tee /etc/systemd/system/pocketbase.service > /dev/null <<EOF
[Unit]
Description=PocketBase
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/haccp-app
ExecStart=/opt/haccp-app/bin/pocketbase serve --http=127.0.0.1:8090 --dir=/opt/haccp-app/data
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable pocketbase
sudo systemctl start pocketbase
```

### Passo 5: Configura HTTPS

```bash
# Genera certificato SSL
sudo mkdir -p /etc/ssl/haccp
sudo openssl req -x509 -nodes -days 3650 \
  -newkey rsa:2048 \
  -keyout /etc/ssl/haccp/key.pem \
  -out /etc/ssl/haccp/cert.pem \
  -subj "/CN=haccp-app.local"
```

### Passo 6: Configura Nginx

```bash
sudo tee /etc/nginx/sites-available/haccp-app > /dev/null <<'EOF'
server {
    listen 80;
    server_name haccp-app.local _;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name haccp-app.local _;

    ssl_certificate /etc/ssl/haccp/cert.pem;
    ssl_certificate_key /etc/ssl/haccp/key.pem;

    root /opt/haccp-app/web;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8090/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /_/ {
        proxy_pass http://127.0.0.1:8090/_/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/haccp-app /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
```

### Passo 7: Configura nome locale (mDNS)

```bash
sudo hostnamectl set-hostname haccp-app
echo "127.0.0.1 haccp-app.local" | sudo tee -a /etc/hosts

sudo tee /etc/avahi/services/haccp.service > /dev/null <<EOF
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name>Tracker HACCP</name>
  <service>
    <type>_https._tcp</type>
    <port>443</port>
  </service>
</service-group>
EOF

sudo systemctl restart avahi-daemon
```

### Passo 8: Primo accesso

1. **App**: `https://haccp-app.local` (accetta certificato)
2. **Admin PocketBase**: `https://haccp-app.local/_/`
3. Crea account admin al primo accesso

---

## 💾 Metodo 3: Immagine SD Pre-configurata

Dopo aver configurato un Raspberry Pi, puoi creare un'immagine clonabile:

```bash
# Sul PC, con SD inserita:
sudo dd if=/dev/sdX of=haccp-tracker.img bs=4M status=progress
gzip haccp-tracker.img
```

Per usarla: scrivi l'immagine su una nuova SD con **Raspberry Pi Imager** o **balenaEtcher**.

---

## 📋 Script Disponibili

| Script | Descrizione |
|--------|-------------|
| `install-haccp-pocketbase.sh` | Installazione automatica completa |
| `setup-github.sh` | Configura sync con GitHub |
| `setup-github-ssh.sh` | Configura GitHub con chiavi SSH |
| `setup-mega-backup.sh` | Backup automatico su MEGA cloud |
| `update-from-github.sh` | Aggiorna app da GitHub |

---

## 🔧 Comandi Utili

```bash
# Stato servizi
sudo systemctl status pocketbase nginx

# Log PocketBase
sudo journalctl -u pocketbase -f

# Backup manuale
sudo tar czf backup-$(date +%Y%m%d).tar.gz /opt/haccp-app/data

# Riavvia tutto
sudo systemctl restart pocketbase nginx
```

---

## ❓ Problemi Comuni

| Problema | Soluzione |
|----------|-----------|
| Pagina non carica | `sudo systemctl status nginx pocketbase` |
| Errore certificato | Normale, accettalo nel browser |
| Nome .local non funziona | Usa IP diretto: `https://192.168.1.X` |
| PocketBase non parte | `sudo journalctl -u pocketbase -n 50` |
