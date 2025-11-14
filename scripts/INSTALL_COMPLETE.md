# 🚀 HACCP App - Installazione Completa Raspberry Pi

## Script di Installazione Automatica

Questo script configura **TUTTO** in modo automatico sul Raspberry Pi:

✅ HACCP App da GitHub  
✅ HTTPS con certificati SSL  
✅ Dominio locale `.local` (mDNS)  
✅ OCR (riconoscimento testo)  
✅ Ritaglio e editing immagini  
✅ Backup automatico su Mega  
✅ PWA installabile  

---

## 📋 Prerequisiti

- **Raspberry Pi 5** con Raspberry Pi OS Lite (64-bit)
- Connessione internet
- Accesso SSH
- Account GitHub con il repository HACCP App
- (Opzionale) Account Mega.nz per backup

---

## 🚀 Installazione

### 1. Accedi al Raspberry Pi via SSH

```bash
ssh pi@raspberrypi.local
# oppure
ssh pi@[IP_DEL_RASPBERRY]
```

### 2. Scarica lo script

```bash
curl -O https://raw.githubusercontent.com/TUO-USERNAME/TUO-REPO/main/scripts/install-raspberry-pi-complete.sh
```

### 3. Rendi lo script eseguibile

```bash
chmod +x install-raspberry-pi-complete.sh
```

### 4. Esegui lo script (SENZA sudo!)

```bash
./install-raspberry-pi-complete.sh
```

### 5. Segui le istruzioni interattive

Lo script ti chiederà:

- **Nome dominio locale** (es. `haccp-app` → diventerà `haccp-app.local`)
- **URL repository GitHub** (es. `https://github.com/username/haccp-app.git`)
- **Branch GitHub** (default: `main`)
- **Configurazione backup Mega** (opzionale)
  - Email Mega
  - Password Mega

### 6. Riavvia

Alla fine dell'installazione, lo script ti chiederà se vuoi riavviare.
**Raccomandato riavviare per completare setup Docker.**

---

## 🌐 Accesso all'App

Dopo l'installazione, l'app sarà accessibile:

### Da computer/tablet/smartphone nella stessa rete:

```
https://haccp-app.local
```

### Da browser (se .local non funziona):

```
https://[IP_DEL_RASPBERRY]
```

> ⚠️ **Nota certificato SSL**  
> Il certificato è self-signed, il browser mostrerà un avviso di sicurezza.  
> Clicca "Avanzate" → "Procedi comunque" per accedere.

---

## 🛠️ Comandi di Gestione

Dopo l'installazione, avrai questi comandi disponibili:

### Aggiornare l'app da GitHub

```bash
sudo update-haccp
```

Questo comando:
- Scarica gli ultimi aggiornamenti da GitHub
- Reinstalla dipendenze se necessario
- Ricompila l'app
- Riavvia Nginx

### Backup manuale su Mega

```bash
sudo backup-haccp
```

Crea un backup e lo carica su Mega.nz.  
**Backup automatico**: Ogni notte alle 2:00 AM.

### Monitorare lo stato

```bash
sudo monitor-haccp
```

Mostra:
- Stato Nginx
- Scadenza certificati SSL
- Dominio .local attivo
- Spazio disco
- Ultimo aggiornamento

### Altri comandi utili

```bash
# Riavviare Nginx
sudo systemctl restart nginx

# Vedere log Nginx
sudo journalctl -u nginx -f

# Vedere log backup
tail -f /var/log/haccp-backup.log

# Test dominio .local
avahi-browse -t _http._tcp
```

---

## 📱 Installare come PWA

1. Apri l'app nel browser: `https://haccp-app.local`
2. Nel menu del browser, cerca "Installa app" o "Aggiungi a Home"
3. L'app verrà installata come applicazione nativa

---

## 🔧 Funzionalità Installate

### OCR (Riconoscimento Testo)

L'app può riconoscere testo da immagini usando Tesseract OCR.

**Lingue installate**:
- Italiano
- Inglese

### Editing Immagini

ImageMagick è installato per operazioni come:
- Ritaglio foto
- Resize
- Conversione formati
- Watermark

### Backup Automatico

Se configurato, ogni notte alle 2:00 AM viene eseguito un backup automatico:

- Codice sorgente (esclusi `node_modules` e `dist`)
- Configurazioni Nginx
- Certificati SSL

Backup salvati su: `/HACCP-Backups` su Mega.nz

---

## 🔐 Sicurezza

### Firewall (UFW)

Porte aperte:
- **22** - SSH
- **80** - HTTP (redirect a HTTPS)
- **443** - HTTPS
- **5353** - mDNS

### Certificati SSL

- Certificati self-signed con validità 365 giorni
- Posizione: `/etc/ssl/haccp/`
- Rinnovo: manuale (o usa Let's Encrypt per produzione)

---

## 🐛 Troubleshooting

### Il dominio .local non funziona

**Verifica che Avahi sia attivo:**

```bash
sudo systemctl status avahi-daemon
```

**Test mDNS:**

```bash
avahi-browse -t _http._tcp
```

Dovresti vedere "HACCP App" nella lista.

### L'app non carica

**Controlla Nginx:**

```bash
sudo systemctl status nginx
sudo nginx -t
```

**Visualizza log errori:**

```bash
sudo journalctl -u nginx -n 50
```

### Backup Mega non funziona

**Verifica credenziali:**

```bash
cat ~/.megarc
```

**Test manuale:**

```bash
megatools df
```

### Rigenerare certificati SSL

```bash
sudo rm -rf /etc/ssl/haccp/*
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/haccp/private.key \
    -out /etc/ssl/haccp/certificate.crt \
    -subj "/C=IT/ST=Italy/L=City/O=HACCP/CN=haccp-app.local"
sudo systemctl reload nginx
```

---

## 📊 Prestazioni e Risorse

### Requisiti minimi

- **RAM**: 2GB (4GB raccomandati)
- **Storage**: 8GB liberi
- **CPU**: Raspberry Pi 5 (o Pi 4)

### Ottimizzazioni

Lo script configura automaticamente:
- Gzip compression in Nginx
- Cache statica per asset
- Headers di sicurezza
- HTTP/2

---

## 🔄 Aggiornamento da Versione Precedente

Se hai già una versione installata:

1. **Backup dati importanti**
2. **Rimuovi installazione precedente:**

```bash
sudo rm -rf /opt/haccp-app
sudo rm /etc/nginx/sites-enabled/haccp-app
sudo rm /etc/nginx/sites-available/haccp-app
```

3. **Esegui nuovo script di installazione**

---

## 📞 Supporto

- **Repository**: [GitHub](https://github.com/TUO-USERNAME/TUO-REPO)
- **Issues**: [GitHub Issues](https://github.com/TUO-USERNAME/TUO-REPO/issues)

---

## 📝 Note Finali

### Produzione

Per un ambiente di produzione, considera:

1. **Certificati Let's Encrypt** invece di self-signed
2. **Dominio reale** invece di `.local`
3. **Database esterno** per backup e scalabilità
4. **Monitoring** (Prometheus, Grafana)

### Sviluppo

Per sviluppo locale:

```bash
cd /opt/haccp-app
npm run dev
```

L'app sarà disponibile su `http://localhost:8080`

---

**Buon lavoro con HACCP App! 🎉**
