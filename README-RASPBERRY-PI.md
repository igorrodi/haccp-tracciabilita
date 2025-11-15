# HACCP App - Installazione Raspberry Pi 5

Guida completa per installare e gestire l'applicazione HACCP su Raspberry Pi 5.

## 🚀 Installazione Completa (UN SOLO COMANDO)

Per installare l'intera applicazione con tutte le dipendenze, database, e configurazioni:

```bash
curl -sSL https://raw.githubusercontent.com/igorrodi/haccp-tracciabilita/main/scripts/install-all-raspberry-pi.sh | bash
```

Questo comando installerà automaticamente:
- ✅ Docker e Docker Compose
- ✅ Node.js 20
- ✅ PostgreSQL client
- ✅ Applicazione HACCP
- ✅ Stack Supabase completo (Database + Studio + API Gateway)
- ✅ Tutte le migrazioni database
- ✅ Backup automatici su Mega.nz (opzionale)
- ✅ Aggiornamenti automatici da GitHub

---

## 📋 Cosa Viene Installato

### Servizi Docker

Dopo l'installazione, avrai questi container in esecuzione:

| Container | Porta | Descrizione |
|-----------|-------|-------------|
| `haccp-app` | 3000 | Applicazione web HACCP |
| `haccp-db` | 5432 | Database PostgreSQL |
| `haccp-studio` | 54323 | Supabase Studio (interfaccia database) |
| `haccp-kong` | 8000 | API Gateway |
| `haccp-meta` | 8080 | Metadata service |

### Accesso ai Servizi

Dopo l'installazione, puoi accedere ai servizi:

**Applicazione HACCP:**
- Locale: http://localhost:3000
- Rete locale: http://[IP-RASPBERRY-PI]:3000

**Supabase Studio (Gestione Database):**
- Locale: http://localhost:54323
- Rete locale: http://[IP-RASPBERRY-PI]:54323

---

## 🔄 Aggiornamento Applicazione

Per aggiornare l'app all'ultima versione da GitHub:

```bash
~/haccp-app/scripts/update-from-github.sh
```

Questo script:
1. ✅ Esegue backup pre-aggiornamento
2. ✅ Scarica gli aggiornamenti da GitHub
3. ✅ Applica nuove migrazioni database
4. ✅ Rebuilda e riavvia l'applicazione
5. ✅ Verifica che tutto funzioni

**Aggiornamenti Automatici:**
L'app si aggiorna automaticamente ogni domenica alle 3:00 AM.

---

## 💾 Backup

### Backup Manuale

Per eseguire un backup immediato:

```bash
~/haccp-app/scripts/backup-to-mega.sh
```

### Configurare Backup Automatici su Mega.nz

Se non l'hai fatto durante l'installazione:

```bash
~/haccp-app/scripts/setup-mega-backup.sh
```

Ti verrà chiesto:
- Email Mega.nz
- Password
- Codice 2FA (se attivo)

**Backup Automatici:**
- Frequenza: Ogni giorno alle 2:00 AM
- Ritenzione locale: 7 giorni
- Ritenzione Mega: 30 giorni

**Cosa viene salvato:**
- ✅ Database completo (dump SQL)
- ✅ Codice sorgente
- ✅ Configurazioni Docker
- ✅ File di configurazione

### Ripristino da Backup

1. Scarica backup da Mega:
   ```bash
   mega-ls /HACCP-Backups/
   mega-get /HACCP-Backups/haccp_backup_[DATA].tar.gz ~/restore/
   ```

2. Estrai backup:
   ```bash
   cd ~/restore
   tar -xzf haccp_backup_[DATA].tar.gz
   ```

3. Ripristina database:
   ```bash
   docker exec -i haccp-db psql -U postgres postgres < database.sql
   ```

---

## ⚙️ Gestione Servizi

### Visualizza Stato

```bash
# Tutti i container
docker ps

# Container HACCP
docker ps --filter "name=haccp"
```

### Log dei Servizi

```bash
# Log applicazione
docker logs -f haccp-app

# Log database
docker logs -f haccp-db

# Log Supabase Studio
docker logs -f haccp-studio

# Log tutti i servizi
cd ~/haccp-app/scripts/docker
docker compose logs -f
```

### Riavvio Servizi

```bash
# Riavvia solo l'app
docker restart haccp-app

# Riavvia tutti i servizi
cd ~/haccp-app/scripts/docker
docker compose restart

# Riavvia servizio specifico
docker compose restart db
```

### Stop/Start Completo

```bash
cd ~/haccp-app/scripts/docker

# Ferma tutto
docker compose down

# Avvia tutto
docker compose up -d

# Riavvia tutto da zero (rimuove anche volumi)
docker compose down -v
docker compose up -d
```

---

## 🔧 Configurazioni

### File Principali

- **Applicazione**: `~/haccp-app/`
- **Docker Compose**: `~/haccp-app/scripts/docker/docker-compose.yml`
- **Migrazioni DB**: `~/haccp-app/supabase/migrations/`
- **Backup locali**: `~/haccp-backups/`
- **Script**: `~/haccp-app/scripts/`

### Variabili d'Ambiente

Il client Supabase è configurato per rilevare automaticamente l'ambiente:
- Se accedi da `localhost` → usa `http://localhost:8000`
- Se accedi da rete locale → usa `http://[IP-RASPBERRY]:8000`

### Porte Utilizzate

| Servizio | Porta | Descrizione |
|----------|-------|-------------|
| App HACCP | 3000 | Interfaccia web principale |
| PostgreSQL | 5432 | Database (solo interno Docker) |
| Supabase Studio | 54323 | UI gestione database |
| Kong API Gateway | 8000 | API Supabase |
| Meta Service | 8080 | Metadata (solo interno Docker) |

---

## 🛠️ Troubleshooting

### L'app non risponde

```bash
# Verifica che i container siano in esecuzione
docker ps

# Riavvia l'app
docker restart haccp-app

# Controlla i log per errori
docker logs haccp-app
```

### Errore connessione database

```bash
# Verifica che il database sia in esecuzione
docker ps | grep haccp-db

# Controlla log database
docker logs haccp-db

# Riavvia database
docker restart haccp-db
```

### Porte già in uso

```bash
# Trova cosa usa la porta (esempio: 3000)
sudo lsof -i :3000

# Termina processo
sudo fuser -k 3000/tcp

# Riavvia servizi
cd ~/haccp-app/scripts/docker
docker compose restart
```

### Reset completo

Se hai problemi gravi e vuoi ripartire da zero:

```bash
# Ferma e rimuovi tutto
cd ~/haccp-app/scripts/docker
docker compose down -v
docker system prune -af

# Reinstalla
curl -sSL https://raw.githubusercontent.com/igorrodi/haccp-tracciabilita/main/scripts/install-all-raspberry-pi.sh | bash
```

---

## 📊 Monitoraggio

### Utilizzo Risorse

```bash
# Statistiche container
docker stats

# Utilizzo disco
df -h
docker system df

# Memoria
free -h
```

### Pulizia Risorse

```bash
# Rimuovi immagini inutilizzate
docker image prune -a

# Rimuovi volumi inutilizzati
docker volume prune

# Pulizia completa (ATTENZIONE: rimuove tutto!)
docker system prune -af --volumes
```

---

## 🔐 Sicurezza

### Accesso da Rete Esterna

Per esporre l'app su internet in modo sicuro:

1. **Configura certificato SSL** (consigliato Let's Encrypt)
2. **Usa un reverse proxy** (Nginx/Caddy)
3. **Configura firewall** per limitare accessi
4. **Cambia password database** default

### Backup Credenziali

Le credenziali Mega per i backup sono salvate in:
- MEGAcmd: `~/.megaCmd/`

⚠️ **IMPORTANTE**: Non condividere mai le credenziali di backup!

---

## 📱 Accesso da Altri Dispositivi

L'app è accessibile da qualsiasi dispositivo sulla stessa rete:

1. Trova l'IP del Raspberry Pi:
   ```bash
   hostname -I
   ```

2. Accedi da browser su altro dispositivo:
   ```
   http://[IP-RASPBERRY-PI]:3000
   ```

---

## 🆘 Supporto

Se hai problemi:

1. Controlla i log: `docker logs haccp-app`
2. Verifica lo stato: `docker ps`
3. Consulta questa guida
4. Apri una issue su GitHub

---

## 📝 Cron Jobs Configurati

```bash
# Visualizza cron jobs
crontab -l

# Backup automatici
0 2 * * * ~/haccp-app/scripts/backup-to-mega.sh

# Aggiornamenti automatici
0 3 * * 0 ~/haccp-app/scripts/update-from-github.sh
```

---

## 🔄 Workflow Sviluppo

### Modifica Codice

1. Modifica su Lovable o localmente
2. Push su GitHub
3. Sul Raspberry Pi:
   ```bash
   ~/haccp-app/scripts/update-from-github.sh
   ```

### Nuove Migrazioni Database

Le migrazioni vengono applicate automaticamente durante l'aggiornamento.
Per applicarle manualmente:

```bash
cd ~/haccp-app
docker exec -i haccp-db psql -U postgres postgres < supabase/migrations/[NOME-MIGRAZIONE].sql
```

---

## 📖 Link Utili

- **Repository GitHub**: https://github.com/igorrodi/haccp-tracciabilita
- **Supabase Docs**: https://supabase.com/docs
- **Docker Docs**: https://docs.docker.com/
- **MEGAcmd Docs**: https://github.com/meganz/MEGAcmd

---

**Versione Guida**: 1.0  
**Ultima Modifica**: $(date +%Y-%m-%d)
