# prizeversity

# Pre-Requisites:
- If you don't have the latest version of Node.js installed, install it from here: https://nodejs.org/en
- Setup the Google/Microsoft OAuth Client IDs along with the Redirect URI(s). See `.env.example` for more info

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
        │    └── index.html
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
> 
> ### Use the Replica Set Connection String
> 
> Now that there's a single-node replica set named `rs0`, include the replica set name in the connection string. For example:
>
> ```
> mongodb://localhost:27017/myDatabase?replicaSet=rs0
> ```
> `myDatabase` can be any DB name desired.
>
> `?replicaSet=rs0` is crucial if the plan is to use transactions.
> 
> This may also be specified in the application’s `.env` file, for example:
>
> ```
> MONGODB_URI=mongodb://localhost:27017/prizeversity?replicaSet=rs0
> ```
>

2. Clone the Repo:

```
git clone https://github.com/nasserhadim/prizeversity.git

cd prizeversity/server
```

3.1 Create a `.gitignore` file to exclude `.env` secrets from being committed/exposed

> - GitHub will not allow pushing to the repository sensitive info like CLIENT ID/SECRETS. Anyways, the `.env` file shouldn't be included publicly in the repo, so to continue using it locally without pushing it to the repo, despite updates to it, a `.gitignore` file works as a great workaround for this scenario here. 
>
> - Simply create a `.gitignore` file (anywhere in project is fine, preferrably at the root, e.g. where the `readme.md` file is for instance). Then add `.env` to the file, commit and push it to the repo. Now when creating/updating a `.env` file, it will be ignored by `git`!

3.2 Create an `.env` file from `.env.example`:

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
pm2 start index.js --name prizeversity-server
pm2 save
pm2 startup
```

> Then configure reverse proxy (NGINX/Apache) to forward traffic from port 80/443 to your Node server.
>
> ### On Windows:
>
> To install nginx/Windows, download the latest mainline version distribution zip (e.g. [nginx/Windows-1.27.3](https://nginx.org/download/nginx-1.27.3.zip)). Then unpack the distribution, go to the nginx-1.27.3 directory, and run nginx. Here is an example for the drive `C:` root directory:
>
> ```
> cd c:\
> unzip nginx-1.27.3.zip
> cd nginx-1.27.3
> start nginx
> ```
> 
> Create a `cert` directory: 
> 
> ```
> C:\nginx-1.27.3\conf\cert\
> ```
>
> #### Generate an SSL/TLS Certificate
> 
> [Pre-Req] If you don't have OpenSSL in your system install it. [An easy way to do it](https://stackoverflow.com/a/51757939/8397835) without running into a risk of installing unknown software from 3rd party websites and risking entries of viruses, is by using the `openssl.exe` that comes inside Git for Windows installation, typically located here: 
> 
> ```
> C:\Program Files\Git\usr\bin\
> ```
> 
> Note: Add the bin path to SYSTEM environment variable to make it easily accessible from CMD/terminal.
>
> 
> Run the command below to generate a self-signed certificate and key:
> 
> ```
> openssl req -x509 -nodes -newkey rsa:2048 -keyout C:\nginx-1.27.3\conf\cert\localhost.key -out C:\nginx-1.27.3\conf\cert\localhost.crt -days 365
> ```
>
> After running the command, you will be prompted to provide some information:
> 
> ```
> Country Name (2 letter code): US
> State or Province Name: MI
> Locality Name: City Name
> Organization Name: Organization
> Organizational Unit Name: localhost
> Common Name: localhost
> Email Address: Email Address
> ```
>
> This command will generate the localhost.key and localhost.crt files in the specified directory.
> 
> Move the `cert` folder to the root of the `C:/` drive, or any other location, but make sure it’s not placed inside the nginx folder.
> 
> #### Configure Nginx
> 
> Open the `C:\nginx-1.27.3\conf\nginx.conf` file and add the following code (inside the `http` block, before the end of the closing `}`. There's no need to edit any other lines, including the existing `server` ones, just simply add the code below within the `http` block as mentioned):
> 
> ```
> server {
>    listen 8000 ssl;
>    listen [::]:8000 ssl;
> 
>    root /var/www/html;
>    index index.html index.htm index.nginx-debian.html;
>
>    server_name localhost;
>    
>    ssl_certificate      C:\cert\localhost.crt;
>    ssl_certificate_key  C:\cert\localhost.key;
>
>    ssl_session_cache    shared:SSL:1m;
>    ssl_session_timeout  5m;
>
>    ssl_ciphers  HIGH:!aNULL:!MD5;
>    ssl_prefer_server_ciphers  on;
>        
>    location / {
>        proxy_set_header        Host $host:$server_port;
>        proxy_set_header        X-Real-IP $remote_addr;
>        proxy_set_header        X-Forwarded-For $proxy_add_x_forwarded_for;
>        proxy_set_header        X-Forwarded-Proto $scheme; 
>        proxy_set_header        Upgrade $http_upgrade;
>        proxy_set_header        Connection "upgrade";
>        proxy_pass              http://localhost:3000/;
>    }
> }
> ```
> 
> #### Verify Nginx Configuration
> 
> Open a command prompt and navigate to the `C:\nginx-1.27.3` directory. To test the Nginx configuration, run the following command (to check for syntax errors):
>
> ```
> nginx -t
> ```
>
> You should see the following output:
> 
> ```
> nginx: the configuration file C:\nginx-1.27.3/conf/nginx.conf syntax is ok
> nginx: configuration file C:\nginx-1.27.3/conf/nginx.conf test is successful
> ```
>
> [TROUBLESHOOTING] If you get an error output like this, it means the port (i.e. `80`) may be occupied, e.g. by IIS for example.
> ```
> nginx: [emerg] bind() to 0.0.0.0:80 failed (10013: An attempt was made to access a socket in a way forbidden by its access permissions)
> nginx: configuration file C:\nginx-1.27.3/conf/nginx.conf test failed
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
> 
> #### Launch nginx.exe
> 
> - Upon verifying the syntax, launch (double-click) `nginx.exe` from the directory `C:\nginx-1.27.3`. You can verify the launch by checking the 32-bit process running in the Task Manager's Background processes.
> 
> - Navigate to `localhost` (or `127.0.0.1`) in the browser and you should see an nginx placeholder page loaded.
>
> #### Navigating as HTTPS
> 
> Nginx configuration is set up to listen for `HTTPS` on port `8000` (`listen 8000 ssl;`), meaning it requires a secure (SSL/TLS) connection for any requests coming to that port. So, in the browser, enter:
> 
> ```
> https://localhost:8000
> ```
> 
> [TROUBLESHOOTING] 502 Bad Gateway
> 
> - Check if the backend application (the one on `localhost:3000`) is actually running and listening on port `3000`. You can do this by opening a browser and navigating to `http://localhost:3000` to see if the application loads. If it's not loading, start or troubleshoot the backend application.
> 
> - Check Nginx's error log, typically in the location specified in the `nginx.conf` file (if unspecified, it's usually in `/var/log/nginx/error.log` on Linux systems, or `C:\nginx-1.27.3\logs\error.log` on Windows). Look for entries related to the `502` error. This might give more specific information about what's going wrong with the upstream server (i.e. `localhost:3000`).
> 
> [OPTIONAL] Redirect HTTP to HTTPS
> 
> To ensure that any HTTP requests to port `8000` (like `http://localhost:8000`) get redirected to the secure version (i.e., `https://localhost:8000`), add a redirection in the Nginx configuration. Here's how you can modify `nginx.conf` to add an HTTP-to-HTTPS redirect:
> 
> ```
> server {
>    listen 8000;
>    server_name localhost;
>
>    # Redirect HTTP requests to HTTPS
>    return 301 https://$host:8000$request_uri;
> }
>
> server {
>    listen 8000 ssl;
>    listen [::]:8000 ssl;
>
>    root /var/www/html;
>    index index.html index.htm index.nginx-debian.html;
>
>    server_name localhost;
>
>    ssl_certificate      C:\cert\localhost.crt;
>    ssl_certificate_key  C:\cert\localhost.key;
>
>    ssl_session_cache    shared:SSL:1m;
>    ssl_session_timeout  5m;
>
>    ssl_ciphers  HIGH:!aNULL:!MD5;
>    ssl_prefer_server_ciphers  on;
>
>    location / {
>        proxy_set_header        Host $host:$server_port;
>        proxy_set_header        X-Real-IP $remote_addr;
>        proxy_set_header        X-Forwarded-For $proxy_add_x_forwarded_for;
>        proxy_set_header        X-Forwarded-Proto $scheme; 
>        proxy_set_header        Upgrade $http_upgrade;
>        proxy_set_header        Connection "upgrade";
>        proxy_pass              http://localhost:3000/;
>    }
> }
> ```
> 
> In this configuration, any request to `http://localhost:8000` will be redirected to `https://localhost:8000` with a `301 Moved Permanently` status, which is the proper way to handle this.
> 
> #### [OPTIONAL] Prevent browser security warning by adding the self-signed certificate to the trusted store on Windows
> 
> ##### Locate certificate
> 
> You should have the self-signed certificate file (e.g., `localhost.crt`) ready. This is the file generated using `OpenSSL`.
> 
> ##### Open Microsoft Management Console (MMC):
> 
> Run > `mmc`
> 
> ##### Add the Certificates Snap-in:
> 
> - In the MMC window, go to `File > Add/Remove Snap-in`.
> - In the `Add or Remove Snap-ins` window, select `Certificates` from the list of available snap-ins and click `Add`.
> - Choose `Computer account` and then `Local computer`, and click `Finish`.
> - Click `OK` to close the Add/Remove Snap-ins window.
> 
> ##### Import the Certificate:
> 
> - Now, in the MMC window, expand the `Certificates (Local Computer)` node in the left-hand pane.
> - Navigate to `Trusted Root Certification Authorities > Certificates`.
> - Right-click on the `Certificates` folder and select `All Tasks > Import`.
> - Click `Next`, then browse to the location of the self-signed certificate file (`localhost.crt`).
> - Select the certificate and click `Next`.
> - Choose `Place all certificates in the following store`, and make sure `Trusted Root Certification Authorities` is selected.
> - Click `Next` and then `Finish`. You should see a confirmation saying the import was successful.
> 
> ##### Restart the Browser:
> 
> - After adding the certificate, restart the browser to make sure it recognizes the newly trusted certificate.
> - Now, when navigating to `https://localhost:8000`, you should no longer see the warning, and the connection should be marked as secure.
> 
> ### On Linux (Ubuntu/Debian):
>
> #### Install NGINX
> 
> ```
> sudo apt-get update
> sudo apt-get install nginx
> ```
> 
> #### Allow HTTP/HTTPS in the firewall (if not enabled):
> 
> ```
> sudo ufw allow 80
> sudo ufw allow 443
> ```
>
> #### Create/Edit an NGINX server block file. Typically on Ubuntu, would be something like this:
> 
> ```
> sudo nano /etc/nginx/sites-available/myapp.conf
> ```
>
> Then add something like:
> 
> ```
> server {
>    listen 80;
>    server_name yourdomain.com www.yourdomain.com;
>
>    # Redirect all HTTP to HTTPS
>    return 301 https://$host$request_uri;
> }
>
> server {
>    listen 443 ssl;
>    server_name yourdomain.com www.yourdomain.com;
>
>    # SSL certificate files from Let's Encrypt or another CA
>    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
>    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
>
>    location / {
>        proxy_pass         http://localhost:5000;   # Node server
>        proxy_http_version 1.1;
>        proxy_set_header   Upgrade $http_upgrade;
>        proxy_set_header   Connection 'upgrade';
>        proxy_set_header   Host $host;
>        proxy_set_header   X-Forwarded-For $remote_addr;
>    }
> }
> ```
> 
> - `server_name`: replace with your actual domain name(s).
> - `ssl_certificate` and `ssl_certificate_key`: if you have SSL from Let’s Encrypt (via certbot), the certs typically live in `/etc/letsencrypt/live/yourdomain.com/`.
> - `proxy_pass http://localhost:5000`: your Node app runs on port `5000`. This can be any internal port.

> #### Enable the site & reload NGINX:
> 
> On Ubuntu:
> ```
> sudo ln -s /etc/nginx/sites-available/myapp.conf /etc/nginx/sites-enabled/
> sudo nginx -t  # check for syntax errors
> sudo systemctl reload nginx
> ```
> 
> NGINX should now listen on ports `80` and `443`.
> 
> Requests to `yourdomain.com` go to NGINX, which in turn proxies them to `http://localhost:5000/`.
> 
> #### Obtaining an SSL Certificate
> 
> A common choice is Let’s Encrypt (free, automated SSL). You can use `certbot` to generate and manage the certificate:
> 
> ##### Install certbot:
> 
> ```
> sudo apt-get install certbot python3-certbot-nginx
> ```
> 
> Run:
> 
> ```
> sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
> ```
>
> - Follow prompts to agree, provide an email, etc.
> 
> - certbot automatically edits your NGINX config to include SSL lines.
> 
> ###### Automatic Renewal:
> 
> `certbot` typically sets up a cron job or systemd timer to renew the certificate. You can verify with `sudo certbot renew --dry-run`.

## Client (React + Bootstrap)

1. Installation

```
cd ../client
cp .env.example .env
npm install
npm install react-scripts
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

## When done correctly, you’ll have:

- https://yourdomain.com → (NGINX on port 443) → Node app on `localhost:5000`
- A secure, production-ready environment with an encrypted session cookie (thanks to your Session Secret) and encrypted traffic (SSL from NGINX).
