# How to Setup:

## Prerequisites:

1. Install [Node.js (for backend and frontend)](https://nodejs.org/).

2. Install [MongoDB (for the database)](https://www.mongodb.com/).
   
   - For [Windows](https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-windows-unattended/#std-label-install-mdb-community-windows-msiexec).

     > Since this installation won't include `mongosh` (mongo shell), you will likely have to create an entry pointing at `mongod.exe` in `Path` under the `System Environment Variables`.
     > 
     > `mongod.exe` will likely be located under some path like `C:\Program Files\MongoDB\Server\8.0\bin`. This `bin` location is the path you will need to add as the entry in `Path` under the `System Environment Variables`!
   
   - For `MacOS`:
   ```
   brew tap mongodb/brew
   brew install mongodb-community@7.0
   brew services start mongodb-community@7.0
   ```

   - [OPTIONAL] If it hasn't been installed, you can [download MongoDB Compass from here](https://www.mongodb.com/try/download/compass), which is the GUI client of MongoDB to interact with the database directly :)
   
4. Install a code editor like [VS Code](https://code.visualstudio.com/).

5. Create Google OAuth Client ID/Secret (to be included in the `.env` file later).

> You can create one by navigating to: https://console.cloud.google.com/apis/credentials and then creating a "project".
>
> Make sure to add/register the redirect_uri, e.g. `http://localhost:5000/api/auth/google/callback`. You can do so from the `Project > OAuth 2.0 Client IDs > Authorized redirect URIs > Add URI`
>
> [Ref/Tutorial](https://youtu.be/TjMhPr59qn4?si=EKFlIMkQg4Eq6gDo)

5. Create Microsoft OAuth Client ID/Secret for `.env` file

> You can create one by navigating to `App Registrations` on [Azure Portal](https://portal.azure.com/?quickstart=True#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) and then creating an App Registration. For platform selection, select "web".
> 
> Make sure to add/register the redirect_uri, e.g. `http://localhost:5000/api/auth/microsoft/callback`. You can do so from the `App Registration > Authentication > Add a (web) platform > Add Web Redirect URI` if you didn't do it initially upon creation of the App registration.
> 
> For supported account types, select `Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)`. This is the associated type of the default `/common` auth API callback Microsoft uses.

## Create Project Folders/Files:

```
prizeversity/
├── backend/
   └── .env
├── frontend/
└── README.md
└── .gitignore
```

> `gitignore` Note: 
>
> - In the `.gitignore` file, add `.env` so that updates to this file, like adding secrets, are ignored upon commits, otherwise, github will prevent the commits from syncing!
>
> - If for some reason the `.env` file doesn't get ignored when you're committing changes throughout the project, try clearing the cache of the file from git by running: `git rm --cached .env` 

## Initialize Backend and Frontend:

### Navigate to the backend folder and run:

```
npm init -y # DON'T RUN THIS UNLESS SETTING UP THE DIRECTORIES FROM SCRATCH!

npm install express mongoose passport passport-google-oauth20 passport-microsoft cors dotenv

npm install socket.io
```

> Now create the following files (UNNECESSARY IF CLONING/FORKING!):
>
> Create `backend/.env`
>
> Create `backend/server.js`
>
> Create `backend/config/passport.js`
>
> Create `backend/models/User.js`
>
> Add the rest of folders/files as needed!

### Frontend Setup with `Vite`.
```
npm create vite@latest frontend -- --template react # If prompted for framework, select React, and variant: JavaScript # DON'T RUN THIS UNLESS SETTING UP THE DIRECTORIES FROM SCRATCH!

cd frontend

npm install

npm install axios react-router-dom socket.io-client

npm install react-transition-group
```
> Now create the following files (UNNECESSARY IF CLONING/FORKING!):
>
> Create `frontend/vite.config.js`
>
> Create `frontend/src/main.jsx`
>
> Create `frontend/src/App.jsx`
>
> Create `frontend/src/pages/Home.jsx`
>
> Add the rest of the folders/files as needed!
# How to Run it:

1. Start MongoDB:

```
mongod
```

> Note:
>
> On MacOS, you may have a service using port `5000`, which you can check with this command: `lsof -i:5000`
>
> [Normally, it might be Control Center that uses it](https://stackoverflow.com/a/72369347/8397835), which you can `turn off` as follows: `System Settings > General > AirDrop & Handoff > AirPlay Receiver.`
> 

2. Start the backend:

```
cd backend
node server.js
```

3. Start the frontend:

```
cd frontend
npm run dev # (DEV ONLY) Vite dev server; Useful for local coding or temporary remote previews.
npm run build # (PROD) Node/Express or Nginx serves dist/ # Just regular HTTP/HTTPS traffic; Users hit port 80/443; 5173 never sees a packet!
```

4. Open the browser and navigate to `http://localhost:5173` (Vite’s default port).


# When trying to Sync (Rebase basically) from original (main) to Fork:

```
git remote add upstream https://github.com/nasserhadim/prizeversity.git # RUN THIS LINE ONLY THE FIRST TIME ON YOUR FORK

git fetch upstream

git merge upstream/main
```

# Launch-to-Production Checklist
Written for an Ubuntu-based Hostinger KVM 4, but the commands are nearly identical on Debian.

1. Prepare the code
```
# on your laptop or dev machine
cd frontend
npm ci           # reproducible install
npm run build    # creates ./dist (static assets)
git add .
git commit -m "Production build"
git push origin main
```

2. Initial server hardening (run once)
```
# SSH in as root or sudo user
apt update && apt upgrade -y

# 2.1  Add a swap file (keeps the box alive on rare RAM spikes)
fallocate -l 2G /swap.img
chmod 600 /swap.img
mkswap /swap.img
swapon /swap.img
echo '/swap.img none swap sw 0 0' >> /etc/fstab

# 2.2  Raise file-descriptor limits
echo '* soft nofile 65535' >> /etc/security/limits.conf
echo '* hard nofile 65535' >> /etc/security/limits.conf
echo 'fs.file-max = 100000' >> /etc/sysctl.conf
sysctl -p                       # reload kernel params

# 2.3  Basic firewall (Unless already setup from the UI; NO need to open port 27017 because the app and DB share the same box.)
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment "SSH"
ufw allow 80/tcp comment "HTTP"
ufw allow 443/tcp comment "HTTPS"
ufw enable
```

3. Install runtime tooling (run once)
```
# 3·A  Node + build utils
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs build-essential

# 3·A  PM2 process manager
npm install -g pm2

# 3·A  MongoDB (single box)
curl -fsSL https://pgp.mongodb.com/server-6.0.asc | \
      tee /etc/apt/trusted.gpg.d/mongodb.asc
echo "deb [arch=amd64] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" \
      | tee /etc/apt/sources.list.d/mongodb-org-6.0.list
apt update && apt install -y mongodb-org
systemctl enable --now mongod

# 3·A·1  Limit Mongo to loopback only
sed -i 's/^  bindIp:.*/  bindIp: 127.0.0.1/' /etc/mongod.conf


#########################################################################
# 3·B  OPTIONAL but recommended: flip that one mongod into replica-set mode
#########################################################################

# 3·B·1  Add a replSetName to the config
printf "\nreplication:\n  replSetName: rs0\n" >> /etc/mongod.conf

# 3·B·2  Restart Mongo so it reads the new stanza
systemctl restart mongod

# 3·B·3  Initialise the single-node replica set
mongosh --eval 'rs.initiate()'      # will output “ok: 1” on success

# 3·B·4  Quick sanity check (should show PRIMARY, 1 member)
mongosh --eval 'rs.status().members.map(m => m.stateStr)'
# → [ "PRIMARY" ]
#########################################################################
```

4. Deploy the application
```
# as a non-root deploy user
mkdir -p ~/app && cd ~/app
git clone https://github.com/nasserhadim/prizeversity.git .
npm ci            # backend dependencies
npm run build -w frontend   # if using workspaces

# Serve static files & API with Express
# (skip if you already have an Nginx reverse proxy plan)
pm2 start ecosystem.config.js --name prize-tower
pm2 save            # write dump
pm2 startup         # generates a systemd script; run the displayed command
```

> Example ecosystem.config.js:

```
module.exports = {
  apps: [{
    name: 'prizeversity',
    script: './server/index.js',
    instances: 'max',        // one cluster worker per vCPU (4)
    exec_mode: 'cluster',
    listen_timeout: 10000,   // health-probe timeout
    max_memory_restart: '500M',
    env: { NODE_ENV: 'production' }
  }]
};
```


6. TLS, CDN & HTTP/2

6.1 Cloudflare DNS
- Add an A-record for app.example.com → VPS IP
- Orange-cloud it (proxy on).
- Cloudflare automatically gives edge SSL and Brotli compression.
  
6.2 Origin certificate
```
apt install -y certbot
certbot certonly --standalone -d app.example.com --agree-tos -m you@example.com
```

6.3 Nginx reverse proxy (if wanting full HTTP/2 + gzip at origin):
```
apt install -y nginx
cat >/etc/nginx/sites-available/prizeversity <<'EOF'
server {
    listen 80;
    server_name app.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.example.com;

    ssl_certificate     /etc/letsencrypt/live/app.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;    # your Express port
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    location /static/ {
        root /home/deploy/app/frontend/dist;
        try_files $uri =404;
    }
}
EOF

ln -s /etc/nginx/sites-available/prizeversity /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```


8. Automated backups

8.1 Create an S3-compatible bucket
- Any provider works (AWS, Backblaze B2, Wasabi).
- Size ≈ compressed dump × 30 days.

8.2 Install rclone & script
```
apt install -y rclone
rclone config    # one-time wizard → create remote called “s3”
mkdir -p ~/backup-scripts
cat >~/backup-scripts/mongodb-nightly.sh <<'EOF'
#!/usr/bin/env bash
set -e
STAMP=$(date +%F)
mongodump --archive="/tmp/mongo-$STAMP.gz" --gzip
rclone copy "/tmp/mongo-$STAMP.gz" s3:prize-tower-backups/$STAMP.gz
rm /tmp/mongo-$STAMP.gz
EOF
chmod +x ~/backup-scripts/mongodb-nightly.sh
```

8.3 Add a cron:
```
crontab -e    # as root
0 2 * * * /home/deploy/backup-scripts/mongodb-nightly.sh
```

10. Final sanity check
```
# From your laptop
curl -I https://app.example.com        # 200 OK, TLS, CF headers
ab -n 500 -c 50 https://app.example.com/api/ping   # latency < 100 ms
```

- If both pass, Great! 🥳.
- Keep an eye on CPU, RAM and backup logs, and we're in good shape.

11. (Next phase) Replica set or scaling
    
Single box is fine at launch; create a secondary VPS and init a replica set when:
- RAM ≥ 80 %, or
- p95 API latency > 300 ms under real traffic.

12. Monitoring & Alerts
```
apt install -y prometheus-node-exporter
pm2 install pm2-server-monit
# or just use Hostinger’s graphs + email alerts
```

> Set Cloudflare / UptimeRobot pings on `/healthz` endpoint that simply returns `200 OK`.
