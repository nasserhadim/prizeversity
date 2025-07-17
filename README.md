# 🎓 About PrizeVersity

- [PrizeVersity](https://www.prizeversity.com/) is a [gamified](https://teaching.uchicago.edu/news/pedagogy-corner/what-gamification) educational platform ("ed-tech") that transforms classrooms into dynamic, engaging ecosystems. 
- Instructors can create custom classrooms, award virtual currency—**"Bits"**—and build in-class reward systems through a virtual shop—**"Bazaar"**—where students redeem their earnings for real or creative perks (e.g., extra credit, club merch, lab/exam passes, etc.)
- Whether through solo play or guild collaboration, students are rewarded for participation, learning, and consistent engagement.

## Key features include:

- Custom classroom creation and management (including **Announcements**, **GroupSets/sub-groups**, **role-based access control (RBAC)** between Students ⇌ TAs, and more!)
- Virtual currency economy (**Bits**)
- Reward system with dynamic **Bazaar**
- Gamified **stat-based mechanics** (such as **Discount**, **multiplier**, **luck**, **Shield**, and **Attack Bonus**)
- User stats, profiles, leaderboard, and transaction history dashboards.

## 🛠️ For Developers
This repository hosts the full stack implementation of PrizeVersity, including the frontend, backend, and infrastructure setup.

- **Frontend**: React.js
- **Backend**: Node.js / Express
- **Database**: MongoDB
- **Infrastructure**: Configured for deployment on a server, featuring:
   - **UFW (Firewall)**
   - **PM2** (Process Manager for Node.js)
   - **SSL (Encryption in transit)**
   - **Persistent MongoDB storage** with replica set compatibility

# How to Setup:

## Prerequisites:

1. Install [Node.js (for backend and frontend)](https://nodejs.org/).
   > **NPM Usage**: This guide uses `npm install` for adding new packages (scaffolding) and `npm ci` for reproducible installs from existing lockfiles (cloning/deployment).

2. Install [MongoDB (for the database)](https://www.mongodb.com/).
   
   - For [Windows](https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-windows-unattended/#std-label-install-mdb-community-windows-msiexec).

     > Since this installation won't include `mongosh` (mongo shell), you will likely have to create an entry pointing at `mongod.exe` in `Path` under the `System Environment Variables`.
     > 
     > `mongod.exe` will likely be located under some path like `C:\Program Files\MongoDB\Server\6.0\bin`. This `bin` location is the path you will need to add as the entry in `Path` under the `System Environment Variables`!
   
   - For `MacOS`:
   ```
   brew tap mongodb/brew
   brew install mongodb-community@7.0
   brew services start mongodb-community@7.0
   ```

   - [OPTIONAL] If it hasn't been installed, you can [download MongoDB Compass from here](https://www.mongodb.com/try/download/compass), which is the GUI client of MongoDB to interact with the database directly :)
   
3. Install a code editor like [VS Code](https://code.visualstudio.com/).

4. Create Google OAuth Client ID/Secret (to be included in the `.env` file later).

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

## Create Project Folders/Files (SKIP THIS IF CLONING/FORKING!):

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
>
> - See the `.gitignore` file for other artifacts to ignore such as `node_modules` 

## Initialize Backend and Frontend (IF CLONING/FORKING, ONLY RUN THE INSTALL STEPS!):

### Scaffold `backend`:

```
cd backend

npm init -y # DON'T RUN THIS UNLESS SETTING UP FROM SCRATCH!

npm install express mongoose passport passport-google-oauth20 passport-microsoft cors dotenv

npm install socket.io

npm install multer

# --- NEW: migrations ---
npm i -D migrate-mongo
npx migrate-mongo init                      # adds migrate-mongo-config.js + migrations/
npx migrate-mongo status                    # Sanity Check. If you see an empty table i.e. (Filename │ Applied At │ Migration block), that just means you haven’t created any migration files yet, which is OK!

npm pkg set scripts.migrate="migrate-mongo up"
npm pkg set scripts["migrate:down"]="migrate-mongo down"
```

## (OPTIONAL but RECOMMENDED) Test DB Migration setup with a "Trial" migration file

1. Generate an empty migration file inside `backend/migrations/`
   ```
   cd backend
   npx migrate-mongo create add-users-test-migration
   ```
   This generates something like `backend/migrations/20250530XXXXXX-add-users-test-migration.js`.
   
2. Open that file and paste your up/down code:
   ```
   // backend/migrations/20250530XXXXXX-add-users-test-migration.js
   module.exports = {
     async up(db) {
       // create a throw-away collection with one unique index
       await db.collection('users_test_migration').createIndex({ email: 1 }, { unique: true });
       // insert a sample doc so you can see it in Compass
       await db.collection('users_test_migration').insertOne({
         email: 'test@example.com',
         createdAt: new Date()
       });
     },
   
     async down(db) {
       // drop the entire test collection
       await db.collection('users_test_migration').drop();
     },
   };
   ```

   > Note:
   >
   > No existing collections are touched; if the collection already exists the index command simply re-asserts the uniqueness rule.
3. Run the migration against your normal database
   ```
   npm run migrate         # migrate-mongo up
   ```

   > Console output should list the file as Applied.
   >
   > Open `MongoDB Compass` → DB `prizeversity` → you’ll see `users_test_migration` with one document and one index.
   
4. (OPTIONAL) Roll it back
   ```
   npm run migrate:down    # drops the test collection
   ```

   > `migrate-mongo status` will now show the migration as "Down," proving that both directions work.
   
5. Commit and keep the file (or delete later)
   - Keeping it lets future contributors see an example migration.
   - Deleting it is fine too—just make sure it’s rolled down first.

## (Resume `backend` scaffolding following DB migrations setup): Create the following files (UNNECESSARY IF CLONING/FORKING!):

> Create `backend/.env`
>
> Create `backend/server.js`
>
> Create `backend/config/passport.js`
>
> Create `backend/models/User.js`
>
> Add the rest of folders/files as needed!

### Scaffold `frontend` and setup with `Vite`.

- `Vite` is a developer convenience server.
- During local **dev**, you point your browser straight at `http://localhost:5173`; `Vite` hot-reloads `React` code and, if configured, transparently proxies API calls to `http://localhost:5000`.
- Vite’s built-in dev server can forward `/api/*` calls to `http://localhost:5000` if you set the `proxy` option in `vite.config.js`.
- In **production**, `Vite` is completely out of the picture—you build once (`npm run build`) and `Nginx` (or `Cloudflare + Nginx`) terminates `HTTPS`, serves static `dist/` files/assets, and forwards/proxies API/WebSocket traffic to the private `Node` port (i.e. `80` → `443` (public) → internal `5000`).

```
cd ..                                     # back to repo root

npm create vite@latest frontend -- --template react # If prompted for framework, select React, and variant: JavaScript # DON'T RUN THIS UNLESS SETTING UP FROM SCRATCH!

cd frontend

npm install

npm install axios react-router-dom socket.io-client

npm install react-transition-group

npm install lucide-react

npm install react-hot-toast

npm install xlsx

npm install file-saver

npm install daisyui

npm install -D tailwindcss@3

npx tailwindcss init # DON'T RUN THIS UNLESS SETTING UP FROM SCRATCH!
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

## 1.1 Start MongoDB locally (execute the commands based on your OS):

> NOTE:
>
> MongoDB needs a data folder where it stores its database files. By default, MongoDB uses `/data/db` on Linux/macOS.

- **macOS – Homebrew (Apple Silicon)**

```
# one-time setup
sudo mkdir -p /opt/homebrew/var/mongodb
sudo chown -R "$(whoami)" /opt/homebrew/var/mongodb

# start the server
mongod --dbpath /opt/homebrew/var/mongodb
```

- **macOS – Homebrew (Intel)**

```
sudo mkdir -p /usr/local/var/mongodb
sudo chown -R "$(whoami)" /usr/local/var/mongodb

mongod --dbpath /usr/local/var/mongodb
```

- **Windows 10 / 11**

```
# one-time setup
mkdir C:\data\db

# start the server
"C:\Program Files\MongoDB\Server\6.0\bin\mongod.exe" --dbpath "C:\data\db"

# (if mongod.exe is on your PATH you can shorten to:)
# mongod --dbpath "C:\data\db"
```

- **Ubuntu / Debian (APT install)**

```
sudo systemctl start mongod      # start now
sudo systemctl enable mongod     # start at every boot
```
> **NOTE:** The APT package already created `/var/lib/mongodb` and set permissions.

- **Any Linux (tarball install)**

```
mkdir -p ~/mongodb-data
mongod --dbpath ~/mongodb-data
```

### Verify the server is running (Linux)

```
mongo --eval 'db.runCommand({ ping: 1 })'   # returns { "ok" : 1 }
```

> Note:
>
> On MacOS, you may have a service using port `5000`, which you can check with this command: `lsof -i:5000`
>
> [Normally, it might be Control Center that uses it](https://stackoverflow.com/a/72369347/8397835), which you can `turn off` as follows: `System Settings > General > AirDrop & Handoff > AirPlay Receiver.`
> 

## 1.2. (OPTIONAL but RECOMMENDED) Enable [single-node replica set](https://www.mongodb.com/docs/manual/tutorial/convert-standalone-to-replica-set/) (aka **Cluster**, provides Fault Tolerance against Single Point of Failure; Ensures Data **Availability**/**Redundancy**/**Concurrency**).
- **Required Pre-requisite**: [mongosh (MongoDB Shell) INSTALLATION](https://www.mongodb.com/try/download/shell)
- **CLI requirement** – any MongoDB shell (`mongosh` ≥5 or legacy `mongo`) must be in your `PATH` to run replica-set commands.
- FYI, on **Windows**, the [Database Tools MSI](https://www.mongodb.com/try/download/database-tools) or the [MongoDB Shell MSI](https://www.mongodb.com/try/download/shell) puts `mongosh.exe` in `C:\Program Files\MongoDB\Server\<ver>\bin`—add that folder to `Path` as needed.

### 1.2.1. Start `mongod` with a replica-set name
  
  - **NOTE:** `mongod` is a network service, so it "listens" on one or more **network interfaces**—the IP addresses your computer exposes to the world:

| Interface type | Typical address | Who can reach it if MongoDB listens here? |
|----------------|-----------------|-------------------------------------------|
| **Loopback** | `127.0.0.1` (alias `localhost`) | **Only** programs running on the **same** machine. |
| **Ethernet / Wi-Fi** | e.g. `192.168.1.23` or `10.0.0.5` | Any device on your local LAN/VPN that can hit that IP. |
| **Public NIC** (cloud VM) | your public IPv4/IPv6 | The entire Internet, unless blocked by a firewall. |

  - Adding `--bind_ip 127.0.0.1` to the `mongod` command confines the server to loopback, preventing external access during local development.
  - Modern MongoDB packages actually bind to `127.0.0.1` by default, but adding the flag makes your intent explicit and prevents surprises if someone edits `mongod.conf` later.
  
To launch `mongod` (the MongoDB server process) with a replica set configuration, the simplest approach would be specifying the `--replSet` option and pointing to the data directory, e.g. on **Windows** `C:\data\db` or **Mac/Linux** `/data/db`:

```
# mac / Linux example – adjust --dbpath to your OS path
mongod --dbpath "/usr/local/var/mongodb" --replSet rs0 --bind_ip 127.0.0.1
```

> **Tip:** On Windows, just adapt the `--dbpath` path (e.g. `C:\data\db`).
>
> Also note that the command may have to be run as Administrator or specify the path in quotes if it has spaces.
> 
> Upon running this command, it should start mongod and log messages to the console. Keep this window open.

### 1.2.2. Open Another Terminal & Connect via mongosh

- Leave the first terminal running (where mongod is started).
- Open a new terminal window (or Command Prompt/PowerShell).
- Run:

```
mongosh                   # defaults to mongodb://127.0.0.1:27017
```

### 1.2.3. Now, in the Mongo shell (mongosh), initialize the replica set

```
rs.initiate()             // expect { ok: 1 }
```

> This is the simplest method. If successful, you’ll see something like:
>
> ```
> {
> "ok" : 1,
> ...
> }
> ```
> 
> and some logs in the mongod window indicating that the replica set is starting.
> 
> **[TROUBLESHOOTING]**
>
> `MongoServerError[NoReplicationEnabled]: This node was not started with replication enabled.` → make sure no background `mongod` service is already bound to port `27017`. Stop it, then restart with `--replSet`.

### 1.2.4. Confirm Replica Set is Running

- After `rs.initiate()`, your prompt in mongosh might change from `>` to something like `rs0 [primary] >`. This indicates you have a single-node replica set named `rs0`.
- You can check the status with:

```
rs.status()               // look for "myState" : 1 (meaning PRIMARY).
```

> **[TROUBLESHOOTING]** Possible reasons it’s still Secondary
>
> Usually with a single node, election is almost instant.
>
> But occasionally you might see a brief `SECONDARY` prompt before it transitions to `PRIMARY`. When the shell shows `[direct: secondary]`, it just means the shell believes it’s directly connected to a node that is currently acting as a `SECONDARY`.
>
> Try waiting a few seconds, then `rs.status()` again.
>
> **Shell still showing `SECONDARY`**?
> 
> - If MongoDB sees itself as `127.0.0.1:27017` but the config says `localhost:27017`, it can prevent it from recognizing itself.
> 
> - Or vice versa: if you used `localhost` to start mongod but the config uses `127.0.0.1`.
> 
> - On **Windows**, sometimes `DESKTOP-XYZ:27017` (your machine’s hostname) can appear.
> 
> Sometimes the simplest fix is to re-initialize with a clean config specifying only one member, explicitly matching how you started mongod. In the shell, do:
> 
> ```
> rs.initiate({
>  _id: "rs0",
>  members: [
>    { _id: 0, host: "127.0.0.1:27017" }
>  ]
>})
> ```
> 
> **[Important]:**
>
> Make sure the host value here matches how you actually started MongoDB.
>
> - If you started it with `mongod --replSet rs0 --bind_ip 127.0.0.1 --port 27017`, then `host: 127.0.0.1:27017` is correct.
> 
> - If you used `localhost`, you can keep it as `localhost:27017`.
> 
> The key is to be consistent.

### 1.2.5. Update the connection string (for transactions & change streams)

Now that there's a single-node replica set named `rs0`, include the replica set name in the connection string. For example, in `.env`:

```
MONGODB_URI=mongodb://127.0.0.1:27017/prizeversity?replicaSet=rs0
```

## 2. Run database migrations (idempotent)

- Database migration is a process of managing and applying changes to DB schema as a project develops while keeping the existing data.
- It allows developers and database administrators to version and track changes to the database structure without breaking any part of the database
- An idempotent operation can be run multiple times without altering the results.
- This means that if a migration script is run multiple times, it will always produce the same outcome.
- This property ensures predictability and stability during the migration process.
- MongoDB's flexible schema allows for changes without modifying existing data. New fields can be added to documents without affecting others. Migrations help manage these changes over time.

```
cd backend
npm run migrate            # migrate-mongo up; FYI, if the DB doesn't exit, this will create it
cd ..
```

After starting MongoDB locally, 

## 3. Start the backend:

```
cd backend
node server.js            # FYI, if the DB doesn't exit, this will create it
```

## 4. Start the frontend:

```
cd frontend
npm run dev # (DEV ONLY) Vite dev server; Useful for local coding or temporary remote previews.
npm run build # (PROD) Node/Express or Nginx serves dist/ # Just regular HTTP/HTTPS traffic; Users hit port 80/443; 5173 never sees a packet!
```

> Open the browser and navigate to `http://localhost:5173` (Vite’s default port).

# Getting Started (clone / fork)

## 1. Clone the repo
### Windows/MacOS:
```
git clone https://github.com/some-org/prizeversity.git
cd prizeversity
```

### Linux OS
1. First, configure the private/public keys on server/github:
```
ssh-keygen -t ed25519 -C "ci@prizeversity" -f ~/.ssh/prizeversity-ci
eval $(ssh-agent -s)
~/.ssh/config # IF CONFIG DOESNT EXIST, create/edit it then esc and :wq to save/quit: touch ~/.ssh/config && vim ~/.ssh/config
ssh-add ~/.ssh/prizeversity-ci
cat ~/.ssh/prizeversity-ci.pub # Fetch the public key (which should start with ssh-ed25519 and end with ci@prizeversity) to create/paste it in a github ssh key: https://github.com/settings/keys
ssh -T git@github.com # RUN THIS AFTER creating the ssh key in the github settings to confirm authentication works
```
2. Now, git clone should work with ssh
```
mkdir -p ~/app && cd ~/app # Create directory under the root/HOME to clone/store the website
git clone git@github.com:nasserhadim/prizeversity.git
cd app/prizeversity
```

## 2. Copy environment variables & Edit secrets
```
cp backend/.env.example backend/.env      # then edit secrets
```

## 3. Install dependencies
```
cd backend
npm ci

cd ../frontend
npm ci
```

## 4. Create / start MongoDB locally if you haven't done it yet  *(Community Edition)*
> Skip this section if you connect to MongoDB Atlas or another remote cluster.

- **macOS – Homebrew (Apple Silicon)**

```
# one-time setup
sudo mkdir -p /opt/homebrew/var/mongodb
sudo chown -R "$(whoami)" /opt/homebrew/var/mongodb

# start the server
mongod --dbpath /opt/homebrew/var/mongodb
```

- **macOS – Homebrew (Intel)**

```
sudo mkdir -p /usr/local/var/mongodb
sudo chown -R "$(whoami)" /usr/local/var/mongodb

mongod --dbpath /usr/local/var/mongodb
```

- **Windows 10 / 11**

```
# one-time setup
mkdir C:\data\db

# start the server
"C:\Program Files\MongoDB\Server\6.0\bin\mongod.exe" --dbpath "C:\data\db"

# (if mongod.exe is on your PATH you can shorten to:)
# mongod --dbpath "C:\data\db"
```

- **Ubuntu / Debian (APT install)**

```
sudo systemctl start mongod      # start now
sudo systemctl enable mongod     # start at every boot
```
> **NOTE:** The APT package already created `/var/lib/mongodb` and set permissions.

- **Any Linux (tarball install)**

```
mkdir -p ~/mongodb-data
mongod --dbpath ~/mongodb-data
```

### Verify the server is running (Linux)

```
mongo --eval 'db.runCommand({ ping: 1 })'   # returns { "ok" : 1 }
```

## 5. Run database migrations (if you haven't done it yet)
```
cd backend
npm run migrate            # migrate-mongo up
cd ..
```

## 6. Development mode
```
cd backend                 # Express + WebSockets on :5000
node server.js             # FYI, if the DB doesn't exit, this will create it
```

### In a second terminal:
```
cd frontend                # Vite hot-reload on :5173
npm run dev
```

> Open `http://localhost:5173`

## 7. Production build (OPTIONAL local test)
```
cd frontend
npm run build              # outputs frontend/dist

cd ../backend
NODE_ENV=production npm start
```
> Browse `http://localhost:5000`  (served by Express or Nginx proxy)

# When trying to Sync (Rebase basically) from original (main) to Fork:

```
git remote add upstream https://github.com/nasserhadim/prizeversity.git # RUN THIS LINE ONLY THE FIRST TIME ON YOUR FORK

git fetch upstream

git merge upstream/main
```

# Launch-to-Production Checklist
Written for an **Ubuntu-based Hostinger KVM 4**, but the commands are nearly identical on **Debian**.
Although running the `back-end` on **Windows** is possible—the production checklist is written for an Ubuntu‐based VPS because 
- most low-cost clouds ship Linux images only, and
- `Nginx + Let's Encrypt` automation is smoother on Linux.

**Recommendation**: **Windows** works, but if you have no OS constraint, **Linux + Nginx** on a VPS is simpler (package manager updates, `systemd`, `ufw`, etc.).

## 1. (OPTIONAL but RECOMMENDED) Initial server hardening for Performance Enhancement & Security/Firewall (run once)
```
# SSH in as root or sudo user
apt update && apt upgrade -y

# 1.1  Add a swap file (Unnecessary but keeps the box alive on rare RAM spikes)
fallocate -l 2G /swap.img
chmod 600 /swap.img
mkswap /swap.img
swapon /swap.img
echo '/swap.img none swap sw 0 0' >> /etc/fstab

# 1.2  Raise file-descriptor limits (File descriptors are used for pretty much anything that reads or writes, io devices, pipes, sockets etc. Typically you modify this ulimit when using web servers. 128,000 open files will only consume around 128MB of system RAM. That shouldn't be much of a problem on a modern system with many GB of system RAM. WebSockets consume memory per connection and file descriptors, but they aren't heavy on CPU. For 100-150 concurrent users, 150 WebSocket connections aren’t demanding, just around 10 MB memory.)
echo '* soft nofile 65535' >> /etc/security/limits.conf
echo '* hard nofile 65535' >> /etc/security/limits.conf
echo 'fs.file-max = 128000' >> /etc/sysctl.conf
sysctl -p                       # reload kernel params

# 1.3  Basic firewall (Unless already setup from the UI; NO need to open port 27017 because the app and DB share the same box.)
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment "SSH"
ufw allow 80/tcp comment "HTTP"
ufw allow 443/tcp comment "HTTPS"
ufw enable
```

## 2. Install runtime tooling (run once)
```
# 2-A-1 Ensure everything is updated first to avoid package conflicts later
sudo apt update
sudo apt update -y

# 2-A-2  Node + build utils
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs build-essential

# 2-A-3  PM2 (Process Manager for Node.js)
npm install -g pm2

# 2-A-4-1  MongoDB (single box): https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-ubuntu/#installation-methods

which curl && which gpg   # Check if curl and gpg are installed; if not, install them with: sudo apt-get install gnupg curl

curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor # Import the MongoDB public GPG key

cat /etc/lsb-release # Determine which release/version the host is running

# Depending on the version, create the list file (e.g. in this case, Ubuntu 22.04 (Jammy))
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
apt update && apt install -y mongodb-org

sudo apt-get update                   # Reload the package database.
sudo apt-get install -y mongodb-org   # Install MongoDB Community Server.

# 2-A-4-2  Limit Mongo to loopback only
sed -i 's/^  bindIp:.*/  bindIp: 127.0.0.1/' /etc/mongod.conf

# 2-A-4-3 Run it!
sudo systemctl start mongod      # Start MongoDB
sudo systemctl status mongod     # Verify that MongoDB has started successfully.
sudo systemctl enable mongod     # Optionally ensure that MongoDB will start following a system reboot

#########################################################################
# 2-B  OPTIONAL but recommended: flip that one mongod into replica-set mode
#########################################################################

# 2-B-1  Add a replSetName to the config
printf "\nreplication:\n  replSetName: rs0\n" >> /etc/mongod.conf

# 2-B-2  Restart Mongo so it reads the new stanza
systemctl restart mongod

# 2-B-3  Initialise the single-node replica set
mongosh --eval 'rs.initiate()'      # will output “ok: 1” on success

# 2-B-4  Quick sanity check (should show PRIMARY, 1 member)
mongosh --eval 'rs.status().members.map(m => m.stateStr)'
# → [ "PRIMARY" ]

# 2-B-5 (OPTIONAL but RECOMMENDED) To support MongoDB replication or future scalability
echo "vm.max_map_count=131060" | sudo tee -a /etc/sysctl.conf   # Persistently increases max memory maps with a recommended threshold (131060) to avoid ENOMEM (out of memory) or Too many open files errors.
sudo sysctl -p                                                  # Applies the change immediately
cat /proc/sys/vm/max_map_count                                  # Confirms the change worked
sudo systemctl restart mongod
```

## 3. Prepare the code (Assumes repo had been cloned; Check the `# Getting Started (clone / fork)` section above.)
```
# On the server:
cd app/prizeversity # Navigate to app direcory in root/HOME, which assumes this is where prizeversity had been cloned
cd backend
touch .env # create the .env file
vim .env   # copy the .env components then :wq to save/quit
npm ci     # reproducible install

cd ..

cd frontend
npm ci           # reproducible install
npm run build    # creates ./dist (static assets)
git add .
git commit -m "Production build"
git push origin main
```

## 4. Deploy the application
[PLACEHOLDER SPACE]

## 4.5.  Prepare SSH keys for CI/CD

1. **Generate a key pair on your laptop (once)**

   ```
   ssh-keygen -t ed25519 -C "ci@prizeversity" -f ~/.ssh/prizeversity-ci
   ```

   This creates
   - `~/.ssh/prizeversity-ci`   (private key)
   - `~/.ssh/prizeversity-ci.pub` (public key)
   
3. **Copy the public key to the VPS (as your deploy user)**

   ```
   ssh-copy-id -i ~/.ssh/prizeversity-ci.pub deploy@<VPS_IP>
   
   # or, if ssh-copy-id is unavailable:
   # cat ~/.ssh/prizeversity-ci.pub | ssh deploy@<VPS_IP> 'mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys'
   ```
   
5. **Add secrets to the GitHub repo** → `Settings` › `Secrets & variables` › `Actions`

| Secret name | Value |
|-------------|-------|
| `SSH_PRIVATE_KEY` | (paste the **contents** of `prizeversity-ci`) |
| `SSH_USER` | `deploy` |
| `SSH_HOST` | `<VPS_IP>` |
| `SSH_PORT` | `22` (or your custom port) |

4. **Verify**
   
   You should now be able to:
   ```
   ssh -i ~/.ssh/prizeversity-ci deploy@<VPS_IP>    # manual test
   ```

## 5. TLS, CDN & HTTP/2
### 5.1 Cloudflare DNS
- Add an A-record for app.example.com → VPS IP
- Orange-cloud it (proxy on).
- Cloudflare automatically gives edge SSL and Brotli compression.
  
### 5.2 Origin certificate
```
apt install -y certbot
certbot certonly --standalone -d app.example.com --agree-tos -m you@example.com
```

### 5.3 Nginx reverse proxy (if wanting full HTTP/2 + gzip at origin):
- HTTP/2 provides significant performance and efficiency benefits, primarily due to its ability to multiplex multiple requests over a single connection and its efficient use of binary framing. This leads to faster page load times, reduced latency, and improved user experience. This means that a client can start receiving responses for multiple requests at the same time, significantly reducing the time it takes for a page to load.

- Gzip is a data compression utility and a file format used for compressing and decompressing files. It uses the Deflate algorithm, which is known for its efficiency in reducing file size. Gzip is commonly used for web servers and browsers, as it helps improve data transfer speeds by compressing files before sending them and decompressing them upon reception. 
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
        proxy_pass http://127.0.0.1:5000;    # your Express port
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

> **[TROUBLESHOOTING]**
>
> `nginx: [emerg] bind() to 0.0.0.0:80 failed (98: Address already in use)` – another service (often Apache or a second Nginx instance) is holding port `80`.
>
> Stop it (`sudo systemctl stop apache2` or `sudo fuser -k 80/tcp`) and re-run `nginx -t`.

## Appendix · Deploying on Windows Server 2019/2022

### 1. Install prerequisites

- **Node 22 x64** – <https://nodejs.org/>
- **NSSM** (Non-Sucking Service Manager) – turns `PM2` or `Node` into a Windows service.  
  `choco install nssm`  
- **Nginx for Windows** – download the latest *mainline* ZIP and unzip to `C:\nginx`.  
- **win-acme** – free Let's Encrypt client for Windows (ACME):  
  `choco install win-acme`

### 2. Run Node / PM2 as a service

```
powershell
pm2 install pm2-windows-service          # one-time
pm2 start backend\server.js --name prizeversity
pm2 save
```

> `PM2-Windows-Service` installs itself under `Services → PM2` so the API starts on boot (i.e. port `5000`).

### 3. Obtain a real SSL cert

```
wacs.exe --target manual --host mysite.com,www.mysite.com --store centralssl --centralsslstore C:\nginx\cert --installation none --accepttos --email you@example.com
```
- `win-acme` drops `mysite.com.pfx` into `C:\nginx\cert\`.
- Auto-renews via a `Windows Task Scheduler` entry that `win-acme` creates.

**Convert PFX → PEM for Nginx:**

```
openssl pkcs12 -in C:\nginx\cert\mysite.com.pfx -nodes -out C:\nginx\cert\mysite.com.pem
openssl pkey -in C:\nginx\cert\mysite.com.pem -out C:\nginx\cert\mysite.com.key
```

### 4. Configure Nginx as reverse proxy

Edit `C:\nginx\conf\nginx.conf` → inside the `http {}` block add:

```
server {
    listen 80;
    server_name mysite.com www.mysite.com;
    return 301 https://$host$request_uri;     # force HTTPS
}

server {
    listen 443 ssl;
    server_name mysite.com www.mysite.com;

    ssl_certificate     C:/nginx/cert/mysite.com.pem;
    ssl_certificate_key C:/nginx/cert/mysite.com.key;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";
    }
}
```

**Test & start:**

```
cd C:\nginx
.\nginx -t        # syntax OK?
.\nginx           # starts Nginx (or restart with .\nginx -s reload)
```

> **Firewall**: open ports `80` & `443` in Windows Defender Firewall (or your cloud dashboard).

### 5. Troubleshooting

- **Port already in use** → `IIS` or `World Wide Web Publishing` is occupying `80/443`. Disable the service: `Stop-Service W3SVC` then `sc config W3SVC start= disabled`.
- **502 Bad Gateway** → confirm `Node/PM2` listens on `127.0.0.1:5000` and restart `Nginx` (`.\nginx -s reload`) after config edits.
- **Certificate renewal** → win-acme logs to `%programdata%\win-acme\wacs.log`; run `wacs.exe --renew` to test.

## 6. Automated backups
### 6.1 Create an S3-compatible bucket
- Any provider works (AWS, Backblaze B2, Wasabi).
- Size ≈ compressed dump × 30 days.

### 6.2 Install rclone & script
```
apt install -y rclone
rclone config    # one-time wizard → create remote called “s3”
mkdir -p ~/backup-scripts
cat >~/backup-scripts/mongodb-nightly.sh <<'EOF'
#!/usr/bin/env bash
set -e
STAMP=$(date +%F)
mongodump --archive="/tmp/mongo-$STAMP.gz" --gzip
rclone copy "/tmp/mongo-$STAMP.gz" s3:prizeversity-backups/$STAMP.gz
rm /tmp/mongo-$STAMP.gz
EOF
chmod +x ~/backup-scripts/mongodb-nightly.sh
```

### 6.3 Add a cron (scheduled) job:
```
crontab -e    # as root
0 2 * * * /home/deploy/backup-scripts/mongodb-nightly.sh
```

## 7. Final sanity check
```
# From your laptop
curl -I https://app.example.com        # 200 OK, TLS, CF headers
ab -n 500 -c 50 https://app.example.com/api/ping   # latency < 100 ms
```

- If both pass, Great! 🥳.
- Keep an eye on CPU, RAM and backup logs, and we're in good shape.

## 8. (Next phase) Replica set or scaling
Single box is fine at launch; create a secondary VPS and init a replica set when:
- RAM ≥ 80 %, or
- p95 API latency > 300 ms under real traffic.

## 9. Monitoring & Alerts
```
apt install -y prometheus-node-exporter
pm2 install pm2-server-monit
# or just use Hostinger’s graphs + email alerts
```

> Set Cloudflare / UptimeRobot pings on `/healthz` endpoint that simply returns `200 OK`.

## 10. CI/CD Deployment (GitHub Actions workflow)
- Builds & tests the code on every push to `main`
- Uploads the build to VPS server over SSH
- Installs production-only dependencies on the server
- Hot-reloads PM2 process named `prizeversity`

### 10.1 Add a GitHub Environment called production (manual "Approve & Deploy" gate)

> 1. Repository → Settings → Environments → New environment → `production`
>
> 2. Under Deployment protection rules choose “Required reviewers” and add self (or team).
>
> 3. Save.

- Effect: Every push to `main` will pause at "Waiting for approval in environment production".
- Open > Actions → run → Review deployments → Approve and deploy to continue.

### 10.2 Create `.github/workflows/deploy.yml` in the repo
```
name: CI & CD – Prizeversity Production
on: { push: { branches: [ main ] } }

concurrency: { group: production, cancel-in-progress: true }

jobs:
  build-and-deploy:
    runs-on: ubuntu-22.04
    environment: { name: production, url: https://prizeversity.com }

    env:
      APP_DIR: /home/deploy/prizeversity
      NODE_VERSION: 22

    steps:
    - uses: actions/checkout@v4

    - uses: actions/setup-node@v4           # cache is per-folder, so leave default
      with: { node-version: ${{ env.NODE_VERSION }} }

    # ─── Backend ───────────────────────────────────────────
    - name: Install & test backend
      working-directory: backend            # to pick a folder—no manual cd backend needed!
      run: |
        npm ci
        npm run test --if-present

    # ─── Front-end ─────────────────────────────────────────
    - name: Build frontend
      working-directory: frontend           # to pick a folder—no manual cd frontend needed!
      run: |
        npm ci
        npm run build

    # ─── Rsync to server ──────────────────────────────────
    - uses: webfactory/ssh-agent@v0.9.0
      with: { ssh-private-key: ${{ secrets.SSH_PRIVATE_KEY }} }

    - name: Upload code
      run: |
        rsync -az --delete \
          -e "ssh -p ${{ secrets.SSH_PORT }}" \
          --exclude='**/node_modules' \
          ./  ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}:${{ env.APP_DIR }}

    # ─── Remote: deps ▸ migrate ▸ reload ──────────────────
    - name: Install prod deps, run migrations, reload PM2
      run: |
        ssh -p ${{ secrets.SSH_PORT }} ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} <<'EOF'
          set -e
          cd /home/deploy/prizeversity/backend               # because there is no YAML working-directory helper once we’re inside the VPS remote shell, cd is needed
          npm ci --omit=dev
          npm run migrate                                    # migrate-mongo up
          pm2 reload /home/deploy/prizeversity/ecosystem.config.js --update-env
        EOF
```

# MISC

## Database Backup / Restore ( `mongodump` & `mongorestore` )

> These CLI utilities live in **MongoDB Database Tools**. Install them once, add
> the **bin** folder to your `PATH`, and you can snapshot or restore the
> `prizeversity` database any time.

---

### 1. Install the tools

| OS | Install command / download | Typical **bin** path |
|----|----------------------------|----------------------|
| **Windows** | *EITHER* [download the MongoDB Database Tools MSI](https://www.mongodb.com/try/download/database-tools) and run it, *OR* via Chocolatey:<br>```powershell<br>choco install mongodb-database-tools``` | `C:\Program Files\MongoDB\Tools\<version>\bin` |
| **macOS (Homebrew)** | ```bash<br>brew install mongodb-database-tools``` | `/usr/local/bin` (Intel) or `/opt/homebrew/bin` (Apple Silicon) |
| **Ubuntu / Debian** | ```bash<br>sudo apt install mongodb-database-tools```<br>(requires the MongoDB repo already added) | `/usr/bin` |
| **Any Linux tarball** | Download the **`.tgz`** from <https://www.mongodb.com/try/download/database-tools>, unpack, move `bin/` anywhere on your `PATH`. | wherever you unpacked it |

#### (Windows) add **bin** to `PATH`

1. *Settings → System → About → Advanced system settings → Environment Variables*  
2. Edit **Path** → **New** → `C:\Program Files\MongoDB\Tools\<version>\bin`  
3. Open a new terminal and run:  
   ```powershell
   mongodump --version
   mongorestore --version

### 2. Verify installation
```
mongodump --help        # prints options list
mongorestore --help
```

### 3. Common commands for Prizeversity
```
# (Method 1) Full backup of the current DB  (creates ./dump/<date>/ …)
mongodump --db prizeversity --out ./dump/prizeversity-$(date +%F)

# (Method 2) Point-in-time (requires single-node replica-set or replica set)
mongodump --db prizeversity \
          --archive=/tmp/prizeversity-$(date +%F).gz \
          --gzip --oplog

# Restore (drops existing collections then imports)
mongorestore --drop --db prizeversity ./dump/prizeversity-2025-05-30
```
- These commands can be run locally before you experiment in `Compass`, or on the VPS inside the nightly backup script (see `Launch-to-Production Checklist` → `Automated backups`).
- MongoDB creates missing collections automatically during `mongorestore`.

### 4. Automated nightly dump on the VPS

```
# inside ~/backup-scripts/mongodb-nightly.sh
STAMP=$(date +%F)
mongodump --archive="/tmp/mongo-$STAMP.gz" --gzip
rclone copy "/tmp/mongo-$STAMP.gz" s3:prizeversity-backups/$STAMP.gz
rm /tmp/mongo-$STAMP.gz
```
Add to crontab -e:
```
0 2 * * * /home/deploy/backup-scripts/mongodb-nightly.sh
```

# Schema Changes & Migrations

## How Schema Changes and Migrations Work Together

| Step | What you do | Why |
|------|-------------|-----|
| ① **Change the Mongoose model** | **Example**: Edit `Classroom.js` (add/rename/remove field, new index option, etc.). | New code must compile and validate future documents. |
| ② **Write a migration file** (`backend/migrations/yyyymmdd-<slug>.js`) | Programmatically **update existing data** or **create/drop indexes** so the live database matches the new schema. | Old documents won't magically gain the new field; you decide how to back-fill, rename, or remove. |
| ③ **Commit & run** | `git add` the model + migration → Devs/CI call `npm run migrate` → production pipeline runs the same step before `pm2 reload`. | Every environment replays the exact same change set once—and only once. |

---

## Example 1: Add a **description** field

### 1. Update the model

```js
// backend/models/Classroom.js
const ClassroomSchema = new mongoose.Schema({
  name:  { type: String, required: true },
  code:  { type: String, required: true, unique: true },
  teacher:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  bazaars:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'Bazaar' }],
  groups:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
  description: { type: String, default: '' },          // ← NEW
  createdAt: { type: Date, default: Date.now }
});
```

### 2. Create a migration

```bash
npx migrate-mongo create add-classroom-description
```

```js
// backend/migrations/20250601-add-classroom-description.js
module.exports = {
  async up(db) {
    await db.collection('classrooms').updateMany(
      { description: { $exists: false } },
      { $set: { description: '' } }           // back-fill with empty string
    );
  },
  async down(db) {
    await db.collection('classrooms').updateMany(
      {},
      { $unset: { description: '' } }
    );
  },
};
```

Run locally once:

```bash
cd backend
npm run migrate
```

`migrate-mongo status` now lists the file with an "Applied At" timestamp.

---

## Example 2: Rename **groups → guilds**

### 1. Change the schema

```diff
- groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
+ guilds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Guild' }],
```

### 2. Migration to rename the field

```bash
npx migrate-mongo create rename-groups-to-guilds
```

```js
module.exports = {
  async up(db) {
    await db.collection('classrooms').updateMany(
      { groups: { $exists: true } },
      { $rename: { 'groups': 'guilds' } }
    );
  },
  async down(db) {
    await db.collection('classrooms').updateMany(
      { guilds: { $exists: true } },
      { $rename: { 'guilds': 'groups' } }
    );
  },
};
```

---

## Example 3: Add/Drop an **index**

```bash
npx migrate-mongo create add-classroom-code-index
```

```js
module.exports = {
  async up(db) {
    await db.collection('classrooms').createIndex(
      { code: 1 },
      { unique: true, name: 'code_unique' }
    );
  },
  async down(db) {
    await db.collection('classrooms').dropIndex('code_unique');
  },
};
```

---

## Key Principles

| Principle | Explanation |
|-----------|-------------|
| **One concern per file** | Easier roll-backs and conflict resolution. |
| **Idempotent `up()`** | Code should succeed even if partially applied (e.g., `$exists` guards). |
| **Always provide `down()`** | Gives you an "undo" button in dev/staging. |
| **Run migrations before server reload** | The CI/CD YAML already does this (`npm run migrate` then `pm2 reload`). |
| **Leave optional fields missing** | If a new field is non-required and your code handles `undefined`, you can skip the data back-fill. |

---

## Summary

- Migrations live only in `backend/migrations/`; the rest of your app stays unchanged. 
- From now on, any time you touch `Classroom.js` (or any other schema) ask: *Do existing documents need a tweak or new index?*—if yes, add a migration file and you're future-proof.

# Appendix · Optional Nginx/Windows for a local `HTTPS` sandbox

Here’s the **fastest, minimal-surface way to serve your local Node app over HTTPS on Windows**—no Vite, no Docker. Choose **ONE** of the two approaches.

## 1. Use Node’s built-in https module (simplest if you just want HTTPS quickly for local OAuth / SameSite cookies)

- With this method, you would browse `https://localhost:5443` (click through the browser warning).
- No proxy layer; WebSockets keep working.
- Ideal when you only need `SSL` for local `OAuth` redirect-URIs or testing Secure cookies.

### 1.1. Generate a throw-away self-signed cert once
```
mkdir cert && cd cert
openssl req -x509 -nodes -newkey rsa:2048 -days 365 -keyout localhost.key -out localhost.crt -subj "/CN=localhost"
```

### 1.2. Tiny https wrapper (`server.js`)
```
// server.js
const fs   = require("fs");
const http = require("http");      // existing Express app
const app  = require("./app");     // <-- your Express instance

const options = {
  key : fs.readFileSync("cert/localhost.key"),
  cert: fs.readFileSync("cert/localhost.crt")
};

http.createServer(app).listen(5000);            // keep HTTP for curl tests
require("https").createServer(options, app).listen(5443, () =>
  console.log("HTTPS → https://localhost:5443")
);
```

## 2. Use Nginx-for-Windows as a local reverse proxy (keeps server code unchanged and handy if you want to replicate prod proxy `headers`, `gzip`, etc.)

- Useful if you want to mimic the production stack (`Nginx` → `Node`) or test multiple virtual hosts.

### 2.1. Download mainline ZIP → `C:\nginx`

#### Method 1: Manual
- To install nginx/Windows, download the latest mainline version distribution zip (e.g. [nginx/Windows-1.27.3](https://nginx.org/download/nginx-1.27.3.zip)) then unpack (unzip) the distribution into `C:\nginx` destination path.

#### Method 2: CLI
```
Invoke-WebRequest -Uri https://nginx.org/download/nginx-1.27.3.zip -OutFile nginx.zip
Expand-Archive nginx.zip -DestinationPath C:\nginx
```

### 2.2. Generate self-signed cert

- **[Pre-Requisite]** If you don't have `OpenSSL` on your system, install it. [An easy way to do it](https://stackoverflow.com/a/51757939/8397835) without running into a risk of installing unknown software from 3rd party websites and risking entries of viruses, is by using the `openssl.exe` that comes inside `Git` for Windows installation, typically located here: `C:\Program Files\Git\usr\bin\`
- **Note:** Add the `bin` path to `SYSTEM` environment variable to make it easily accessible from CMD/terminal.
- Run the commands below to first create a `cert` directory, then generate a self-signed certificate and key:

```
mkdir C:\nginx\cert
openssl req -x509 -nodes -newkey rsa:2048 -keyout C:\nginx\cert\localhost.key -out C:\nginx\cert\localhost.crt -days 365 -subj "/CN=localhost"
```

- The command will generate the `localhost.key` and `localhost.crt` files in the specified directory.
- After running the command, you will be prompted to provide some information:
```
Country Name (2 letter code): US
State or Province Name: MI
Locality Name: City Name
Organization Name: Organization
Organizational Unit Name: localhost
Common Name: localhost
Email Address: Email Address
```

### 2.3. Configure Nginx

Navigate to `C:\nginx\conf\nginx.conf` (inside the `http {}` block, before the end of the closing `}`. There's no need to edit any other lines, including the existing `server` ones, just simply add the code below within the `http` block as mentioned):

```
server {
    listen  443 ssl;
    server_name localhost;

    ssl_certificate     C:/nginx/cert/localhost.crt;
    ssl_certificate_key C:/nginx/cert/localhost.key;

    location / {
        proxy_pass         http://127.0.0.1:5000;   # your Node port
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Forwarded-For $remote_addr;
    }
}
```

### 2.4. Test and start
```
cd C:\nginx
.\nginx -t   # syntax OK?
.\nginx      # start (background process)
```

You should see the following output:

```
nginx: the configuration file C:\nginx/conf/nginx.conf syntax is ok
nginx: configuration file C:\nginx/conf/nginx.conf test is successful
```

> **[TROUBLESHOOTING]**
>
> If you get an error output like this, it means the port (i.e. `80`) may be occupied, e.g. by `IIS` for example.
> 
> ```
> nginx: [emerg] bind() to 0.0.0.0:80 failed (10013: An attempt was made to access a socket in a way forbidden by its access permissions)
> nginx: configuration file C:\nginx/conf/nginx.conf test failed
> ```
> 
> [Run this command as administrator to free up port](https://stackoverflow.com/a/61668011/8397835) `80`:
>
> ```
> netsh http add iplisten ipaddress=::
> ```
> 
> Then retry the following command again (to check for syntax errors):
> 
> ```
> nginx -t
> ```

### 2.5. Navigating as `HTTPS`

- Upon verifying the syntax, launch (double-click) `nginx.exe` from the directory `C:\nginx`.
- You can verify the launch by checking the 32-bit process running in the Task Manager's Background processes.
- Browse `https://localhost` – you should see your Node API response (or a `404/JSON` greeting). If Node isn’t running you’ll get the nginx default page.

> **NOTE:**
>
> Nginx listens for HTTPS on port `443` (`listen 443 ssl;`).
>
> Your Node API keeps running on the internal port `5000`, which Nginx proxies to.

- Browse `https://localhost`

> **[TROUBLESHOOTING]** 502 Bad Gateway
> 
> - Check if the backend application (the one on `localhost:5000`) is actually running and listening on port `5000`. You can do this by opening a browser and navigating to `http://localhost:5000` to see if the application loads. If it's not loading, start or troubleshoot the backend application.
> 
> - Check Nginx's error log, typically in the location specified in the `nginx.conf` file (if unspecified, it's usually in `/var/log/nginx/error.log` on Linux systems, or `C:\nginx\logs\error.log` on Windows). Look for entries related to the `502` error. This might give more specific information about what's going wrong with the upstream server (i.e. `localhost:3000`).
> 

## 3. Redirect HTTP to HTTPS

### 3.1. If you use Approach 1 – Node’s built-in https wrapper

Add one small Express middleware to the `HTTP` listener (port `5000`) so every plain-HTTP request is permanently redirected to the secure port `5443`:

```
// server.js  (continuing from the snippet already in the README)
const app     = require('./app');     // your existing routes

/* ---------- redirect HTTP → HTTPS ---------- */
app.use((req, res, next) => {
  if (req.secure) return next();  // already https
  return res.redirect(301, `https://${req.hostname}:5443${req.url}`);
});
/* ------------------------------------------- */

http.createServer(app).listen(5000, () =>
  console.log('HTTP  → http://localhost:5000  (redirects)'),
);

require('https')
  .createServer(options, app)
  .listen(5443, () => console.log('HTTPS → https://localhost:5443'));
```

**Behavior:**
- `http://localhost:5000/api/hello` → `301` → `https://localhost:5443/api/hello`.
- WebSockets still work because they connect directly on `wss://localhost:5443` in **dev**.

### 3.2. If you use Approach 2 – Nginx-for-Windows reverse proxy

Add a second `server {}` block that listens on port `80` (or any spare port) and issues a `301` redirect to `HTTPS`:

```
# inside C:\nginx\conf\nginx.conf  — still within the http { } context
server {
    listen 80;
    server_name localhost;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name localhost;

    ssl_certificate     C:/nginx/cert/localhost.crt;
    ssl_certificate_key C:/nginx/cert/localhost.key;

    location / {
        proxy_pass         http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Forwarded-For $remote_addr;
    }
}
```

Steps to apply:

```
cd C:\nginx
.\nginx -t           # confirm syntax = ok
.\nginx -s reload    # hot-reload configuration
```

**Now:**
- `http://localhost` (port `80`) → `301` → `https://localhost/`
- `https://localhost/` proxies to your Node API on port `5000`.

## 4. [OPTIONAL] Prevent browser security warning by adding the self-signed certificate to the trusted store on Windows

### 4.1. Locate certificate

You should have the self-signed certificate file (e.g., `localhost.crt`) ready. This is the file generated using `OpenSSL`.

### 4.2. Open Microsoft Management Console (MMC):

> Run > `mmc`

### 4.3. Add the Certificates Snap-in:

- In the MMC window, go to `File > Add/Remove Snap-in`.
- In the `Add or Remove Snap-ins` window, select `Certificates` from the list of available snap-ins and click `Add`.
- Choose `Computer account` and then `Local computer`, and click `Finish`.
- Click `OK` to close the Add/Remove Snap-ins window.

### 4.4. Import the Certificate:

- Now, in the MMC window, expand the `Certificates (Local Computer)` node in the left-hand pane.
- Navigate to `Trusted Root Certification Authorities > Certificates`.
- Right-click on the `Certificates` folder and select `All Tasks > Import`.
- Click `Next`, then browse to the location of the self-signed certificate file (`localhost.crt`).
- Select the certificate and click `Next`.
- Choose `Place all certificates in the following store`, and make sure `Trusted Root Certification Authorities` is selected.
- Click `Next` and then `Finish`. You should see a confirmation saying the import was successful.

### 4.5. Restart the Browser:

- After adding the certificate, restart the browser to make sure it recognizes the newly trusted certificate.
- Now, when navigating to `https://localhost:5000`, you should no longer see the warning, and the connection should be marked as secure.
