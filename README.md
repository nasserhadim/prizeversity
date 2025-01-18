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
> Check installation by running 
> ```
> mongod --version
> ```
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
> ```
> mongosh
> ```
> 
> This opens the MongoDB shell, connecting to `mongodb://localhost:27017` by default.
>
> If on Windows mongosh is not recognized, make sure the MongoDB Shell is in PATH or use the full path to mongosh.exe.
> 
> ### Now, in the Mongo shell (mongosh), initialize the replica set:
>
> Run:
>
> ```
> rs.initiate()
> ```
> 
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
> [TROUBLESHOOTING] If you get something like this instead `MongoServerError[NoReplicationEnabled]: This node was not started with replication enabled.` Double check a mongodb service isnt running. Normally with the installation, a service may have been automatically started on port 27017, which will conflict! So the service MUST be stopped before initializing the replica set.
> 
> ### Confirm Replica Set is Running
> 
> After `rs.initiate()`, your prompt in mongosh might change from `>` to something like `rs0 [primary] >`. This indicates you have a single-node replica set named `rs0`.
> 
> You can check the status with:
>
> ```
> rs.status()
> ```
>
> Look for `"myState" : 1` (meaning PRIMARY). If `"myState" : 1`, the node is a primary in the single-node replica set.
> 
> [TROUBLESHOOTING] Usually with a single node, election is almost instant. But occasionally you might see a brief “SECONDARY” prompt before it transitions to PRIMARY. When the shell shows `[direct: secondary]`, it just means the shell believes it’s directly connected to a node that is currently acting as a SECONDARY.
> Try waiting a few seconds, then `rs.status()` again.
> 
> ### [TROUBLESHOOTING] Possible Reasons It’s Still Secondary
> - If MongoDB sees itself as 127.0.0.1:27017 but the config says localhost:27017, it can prevent it from recognizing itself.
> 
> - Or vice versa: if you used "localhost" to start mongod but the config uses "127.0.0.1".
> 
> - On Windows, sometimes "DESKTOP-XYZ:27017" (your machine’s hostname) can appear.
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
> [Important]: Make sure the host value here matches how you actually started MongoDB. If you started it with `mongod --replSet rs0 --bind_ip 127.0.0.1 --port 27017`, then host: "127.0.0.1:27017" is correct.
> 
> If you used localhost, you can keep it as "localhost:27017". The key is to be consistent.

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
