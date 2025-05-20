# How to Setup:

## Prerequisites:

1. Install [Node.js (for backend and frontend)](https://nodejs.org/).

2. Install [MongoDB (for the database)](https://www.mongodb.com/).
   
   - For [Windows](https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-windows-unattended/#std-label-install-mdb-community-windows-msiexec).
   
   - For `MacOS`:
   ```
   brew tap mongodb/brew
   brew install mongodb-community@7.0
   brew services start mongodb-community@7.0
   ```
   
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

## Create Project Folders:

```
prizeversity2/
├── backend/
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

> Now create the following files:
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

#### Create Vite Project

```
npm create vite@latest frontend -- --template react # If prompted for framework, select React, and variant: JavaScript # DON'T RUN THIS UNLESS SETTING UP THE DIRECTORIES FROM SCRATCH!

cd frontend

npm install

npm install axios react-router-dom socket.io-client

npm install react-transition-group
```
> Now create the following files:
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

> Start MongoDB:

```
mongod
```

> Start the backend:

```
cd backend
node server.js
```

> Start the frontend:

```
cd frontend
npm run dev
```

> Open the browser and navigate to `http://localhost:5173` (Vite’s default port).


# When trying to Sync (Rebase basically) from original (main) to Fork:

```
git remote add upstream https://github.com/nasserhadim/prizeversity2.git # RUN THIS LINE ONLY THE IFRST TIME ON YOUR FORK

git fetch upstream

git merge upstream/main
```
