import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = process.cwd();
const CONFIG_FLAG = path.join(__dirname, ".configured");
const ENV_PATH = path.join(__dirname, ".env");
import { generate } from "random-words";

const generatePassword = () => {
  const [word1, word2] = generate(2).map(
    (word) => word.charAt(0).toUpperCase() + word.slice(1)
  );

  const number = Math.floor(1000 + Math.random() * 9000);
  const punctuation = [
    "!",
    "@",
    "#",
    "$",
    "%",
    "^",
    "&",
    "*",
    "-",
    "_",
    "=",
    "+",
    ":",
    ";",
    ".",
    "?",
  ];

  return `${
    Math.random() > 0.5
      ? punctuation[Math.floor(Math.random() * punctuation.length)]
      : ""
  }${word1}${word2}${
    punctuation[Math.floor(Math.random() * punctuation.length)]
  }${number}${punctuation[Math.floor(Math.random() * punctuation.length)]}`;
};

export default async function (req, res, next) {
  if (fs.existsSync(CONFIG_FLAG)) {
    return res.send(
      "<h1>Setup already completed.</h1><p>Please restart the server or remove the .configured file to run setup again.</p>"
    );
  }

  const currentDomain = req.headers.host || "localhost:3000"; // fallback for dev
  let status = 200;
  let qStart = Date.now();
  let page = `<!DOCTYPE html>
<html lang="en" >
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Kowloon Setup</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center p-6">
  <main class="bg-white rounded-lg shadow-md max-w-xl w-full p-8">
    <h1 class="text-3xl font-semibold mb-6 text-center text-gray-800">Kowloon Server Setup</h1>
    <form id="setupForm" method="POST" action="/setup" class="space-y-5">
      <div>
        <label for="MONGODB_URI" class="block text-sm font-medium text-gray-700">MongoDB URI</label>
        <input
          type="text"
          id="MONGODB_URI"
          name="MONGODB_URI"
          required
          value="mongodb://localhost:27017/kowloon"
          class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label for="KOWLOON_DOMAIN" class="block text-sm font-medium text-gray-700">Domain</label>
        <input
          type="text"
          id="KOWLOON_DOMAIN"
          name="KOWLOON_DOMAIN"
          required
          value="${currentDomain.replace(/"/g, "&quot;")}"
          class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label for="KOWLOON_ADMIN_USERNAME" class="block text-sm font-medium text-gray-700">Admin Username</label>
        <input
          type="text"
          id="KOWLOON_ADMIN_USERNAME"
          name="KOWLOON_ADMIN_USERNAME"
          required
          value="admin"
          class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label for="KOWLOON_ADMIN_PASSWORD" class="block text-sm font-medium text-gray-700">Admin Password</label>
        <input
          type="text"
          id="KOWLOON_ADMIN_PASSWORD"
          name="KOWLOON_ADMIN_PASSWORD"
          required
          value="${generatePassword()}"
          class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label for="KOWLOON_ADMIN_EMAIL" class="block text-sm font-medium text-gray-700">Admin Email</label>
        <input
          type="email"
          id="KOWLOON_ADMIN_EMAIL"
          name="KOWLOON_ADMIN_EMAIL"
          required
          value="admin@${currentDomain.replace(/"/g, "&quot;")}"
          class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>


      <div>
        <label for="S3_ENDPOINT" class="block text-sm font-medium text-gray-700">S3 Endpoint</label>
        <input
          type="url"
          id="S3_ENDPOINT"
          name="S3_ENDPOINT"
          required
          value="http://${currentDomain.replace(/"/g, "&quot;")}:9000"
          class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label for="S3_BUCKET" class="block text-sm font-medium text-gray-700">S3 Bucket</label>
        <input
          type="text"
          id="S3_BUCKET"
          name="S3_BUCKET"
          required
          value="kowloon"
          class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label for="S3_REGION" class="block text-sm font-medium text-gray-700">S3 Region</label>
        <input
          type="text"
          id="S3_REGION"
          name="S3_REGION"
          required
          value="us-east-1"
          class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label for="S3_ACCESS_KEY" class="block text-sm font-medium text-gray-700">S3 Access Key</label>
        <input
          type="text"
          id="S3_ACCESS_KEY"
          name="S3_ACCESS_KEY"
          required
          value="o1zqzIYpJGhbJjH9bXPy"
          class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label for="S3_ACCESS_SECRET_KEY" class="block text-sm font-medium text-gray-700">S3 Access Secret Key</label>
        <input
          type="text"
          id="S3_ACCESS_SECRET_KEY"
          name="S3_ACCESS_SECRET_KEY"
          required
          value="GkqvvPOQ6NUzjZqW9Jm4tNuFnZtNcYuGqI8UXTTL"
          class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label for="PORT" class="block text-sm font-medium text-gray-700">Server Port</label>
        <input
          type="number"
          id="PORT"
          name="PORT"
          required
          min="1"
          max="65535"
          value="3000"
          class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>

      <button
        type="submit"
        class="w-full py-3 mt-6 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        Save Configuration
      </button>
    </form>
  </main>
</body>
</html>
`;
  let response = {
    queryTime: Date.now() - qStart,
  };
  res.status(status).send(page);
}
