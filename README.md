# prizeversity
# Folder Structure
```
prizeversity/
   ├── server/
   │    ├── config/
   │    │    ├── db.js
   │    │    ├── passport.js
   │    │    └── validate.js
   │    ├── controllers/
   │    │    ├── authController.js
   │    │    ├── bazaarController.js
   │    │    ├── classroomController.js
   │    │    ├── groupController.js
   │    │    ├── itemController.js
   │    │    ├── walletController.js
   │    │    └── errorController.js
   │    ├── middleware/
   │    │    ├── authMiddleware.js
   │    │    └── roleMiddleware.js
   │    ├── models/
   │    │    ├── User.js
   │    │    ├── Classroom.js
   │    │    ├── Bazaar.js
   │    │    ├── BazaarItem.js
   │    │    ├── Wallet.js
   │    │    └── Group.js
   │    ├── routes/
   │    │    ├── authRoutes.js
   │    │    ├── bazaarRoutes.js
   │    │    ├── classroomRoutes.js
   │    │    ├── groupRoutes.js
   │    │    └── walletRoutes.js
   │    ├── utils/
   │    │    └── helpers.js
   │    ├── .env.example
   │    ├── package.json
   │    └── index.js
   └── client/
        ├── public/
        ├── src/
        │    ├── App.js
        │    ├── index.js
        │    ├── pages/
        │    │    ├── LoginPage.jsx
        │    │    ├── RoleSelectionPage.jsx
        │    │    ├── DashboardPage.jsx
        │    │    ├── ClassroomPage.jsx
        │    │    ├── BazaarPage.jsx
        │    │    ├── GroupsPage.jsx
        │    │    ├── WalletPage.jsx
        │    │    ├── PeoplePage.jsx
        │    │    └── NotFoundPage.jsx
        │    ├── components/
        │    │    ├── Navbar.jsx
        │    │    ├── ProtectedRoute.jsx
        │    │    └── ...
        │    ├── services/
        │    │    └── api.js
        │    ├── styles/
        │    │    └── custom.css
        │    └── ...
        ├── .env.example
        └── package.json
```

# Setup Instructions:
## Server:

1. Install MongoDB and ensure it’s running in a Replica Set if you want to use transactions (required for concurrency). For development, you can start a single-node replica set locally.
https://www.mongodb.com/docs/manual/tutorial/convert-standalone-to-replica-set/ 

> [WINDOWS INSTALLATION](https://www.mongodb.com/try/download/community)
> 
> Check installation by running `mongod --version`
> 
> If it's not recognized, check the environment variables path includes it. For example, if the MongoDB directory is located at C:\Program Files\MongoDB\Server\3.2\bin, add that path to the system's PATH (environment variables).
>
> [mongosh/mongodb shell INSTALLATION](https://www.mongodb.com/try/download/shell)
>
> ### Create a Data Directory
> MongoDB needs a data folder where it stores its database files. By default, MongoDB uses /data/db on Linux/macOS.
> 
> For example, on Linux/macOS:
>
> ```
> mkdir -p /data/db
> ```
>
> On Windows (in Command Prompt/PowerShell):
>
> ```
> mkdir C:\data\db
> ```
>
> NOTE: If a data directory already exists for MongoDB, skip this step or use that directory.
>
> ### Start mongod with a Replica Set Name
> 
> We need to launch mongod (the MongoDB server process) with a replica set configuration. The simplest approach is specifying the `--replSet` option and pointing to the data directory:
>
> ```
> mongod --dbpath "/data/db" --replSet "rs0"
> ```
> 
> `--dbpath`: Path to MongoDB data directory.
> 
> `--replSet "rs0"`: Tells MongoDB we want to start this server as a member of a replica set named "rs0".
> 
> Tip: On Windows, just adapt the `--dbpath` path (e.g. `C:\data\db`). Also note that the command may have to be run as Administrator or specify the path in quotes if it has spaces.
> 
> Upon running this command, it should start mongod and log messages to the console. Keep this window open.
>
> ### Open Another Terminal & Connect via mongosh
> 
> Leave the first terminal running (where mongod is started).
>
> Open a new terminal window (or Command Prompt/PowerShell).
> 
> Run:
> 
> `mongosh`
> 
> This opens the MongoDB shell, connecting to `mongodb://localhost:27017` by default.
>
> If on Windows mongosh is not recognized, make sure the MongoDB Shell is in PATH or use the full path to mongosh.exe.

2. Clone the Repo:

```
git clone https://github.com/nasserhadim/prizeversity.git

cd prizeversity/server
```

3. Create an .env file from .env.example:

```
cp .env.example .env
nano .env
```

> Fill in MONGODB_URI, SESSION_SECRET, OAuth credentials, etc.

4. Install Dependencies:

```
npm install
```

5. Run Dev Server (for testing):

```
npm run dev
```

> This starts the server on port defined in .env (default 5000) with nodemon auto-reload.

6. Production (example using PM2):

```
npm install -g pm2
pm2 start index.js --name gamification-server
pm2 save
pm2 startup
```

> Then configure reverse proxy (NGINX/Apache) to forward traffic from port 80/443 to your Node server.

## Client (React + Bootstrap)

1. Installation

```
cd ../client
cp .env.example .env
npm install
npm start
```

- The dev server runs on http://localhost:3000.
- Adjust .env if you need to set a custom API URL.

## When deploying to production:

- Use a reverse proxy (NGINX) to handle SSL on ports 80/443.
- Possibly serve the React build from the same server or from a CDN.
- Keep your Node/Express server behind the proxy, usually on an internal port (e.g., 5000).
- Ensure you’ve allowed incoming traffic on ports 22, 80, and 443 in your VPS firewall.
- Use PM2 or a similar process manager to keep your Node server running.
