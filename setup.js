import readline from "readline/promises";
import fs from "fs/promises";
import path from "path";
import slugify from "slugify";
import crypto from "crypto";
import chalk from "chalk";
import { generate, count } from "random-words";
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

let envFile = ".env",
  title = "My Kowloon Server",
  summary = "My brand new Kowloon server",
  location = "Kowloon, Hong Kong",
  domain = "localhost",
  dbUrl = "mongodb://localhost:27017/",
  dbName = "kowloon",
  jwtKey = "lipsmackinbootywhackin", //crypto.randomBytes(16).toString("hex")
  port = 3000,
  uploadDir = "./uploads",
  registrationIsOpen = false,
  maxUploadSize = 100,
  adminEmail = "admin@localhost",
  adminPassword =
    generate(2)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("") + Math.round(Math.random() * 1000),
  geocodingApiKey = "66d4979f026ce833245063brx2e60a0",
  defaultSettings = {
    title,
    summary,
    location: null,
    domain,
    uploadDir,
    registrationIsOpen,
    maxUploadSize,
    defaultPronouns: {
      subject: "they",
      object: "them",
      possAdj: "their",
      possPro: "theirs",
      reflexive: "themselves",
    },
    blockedDomains: [],
    likeEmojis: [
      {
        name: "Like",
        emoji: "👍",
      },
      {
        name: "Love",
        emoji: "❤️",
      },
      {
        name: "Sad",
        emoji: "😭",
      },
      {
        name: "Angry",
        emoji: "🤬",
      },
      {
        name: "Shocked",
        emoji: "😮",
      },
      {
        name: "Puke",
        emoji: "🤮",
      },
    ],
    adminEmail: "admin@kowloon.social",
    emailServer: {
      protocol: "smtp",
      host: "localhost",
      username: "test",
      password: "test",
    },
    icon: "https://kowloon.social/icons/server.png",
  };
console.log(chalk.yellow.bold("\n\nWelcome to Kowloon!"));
console.log(
  "This script will help you to install your new Kowloon server.\n\nPress Ctrl-C at any time to exit without saving. Default settings are in bold in parenthesis.\n\n"
);
console.log(chalk.yellow.bold("-----Server settings-----"));
title =
  (await rl.question(`What is your server's title (${chalk.bold(title)})? `)) ||
  title;
domain =
  (await rl.question(
    `What is your server's domain, i.e. "kowloon.net" (${chalk.bold(domain)})? `
  )) || domain;
dbUrl =
  (await rl.question(
    `What is the full URL for your MongoDB database (${chalk.bold(dbUrl)})? `
  )) || dbUrl;

dbName =
  (await rl.question(
    `What is the of your your MongoDB database (${chalk.bold(
      slugify(title).toLowerCase()
    )})? `
  )) || slugify(title).toLowerCase();

dbUrl =
  (await rl.question(
    `What is the full URL for your MongoDB database (${chalk.bold(dbUrl)})? `
  )) || dbUrl;

jwtKey =
  (await rl.question(
    `What is the key for your JSONWeb Tokens (${chalk.bold(jwtKey)})? `
  )) || jwtKey;
port =
  (await rl.question(
    `What port should your server run on (${chalk.bold(port)})? `
  )) || port;
uploadDir =
  (await rl.question(
    `What directory should user uploads be saved to (${chalk.bold(
      uploadDir
    )})? `
  )) || uploadDir;
registrationIsOpen =
  (await rl.question(
    `Should user registration be open to anyone? (y/${chalk.bold("n")})? `
  )) == "y" || registrationIsOpen;
maxUploadSize =
  (await rl.question(
    `What is the maximum file size users can upload? (${chalk.bold(
      maxUploadSize + " MB"
    )})? `
  )) == "y" || maxUploadSize;

defaultSettings.title = title;
defaultSettings.summary = summary;
defaultSettings.domain = domain;
defaultSettings.uploadDir = uploadDir;
defaultSettings.registrationIsOpen = registrationIsOpen;
defaultSettings.maxUploadSize = parseInt(maxUploadSize);
console.log(chalk.yellow.bold(`\n\n-----Admin-----`));
console.log(
  chalk.yellow(
    `This is the main admin account for the server that you'll log into to administer the server. Once it's set up, you can create a separate user account for yourself, but you'll use the admin account to do admin things.\n\nA password will be generated for you, or you can choose your own below. ${chalk.bold(
      "Write it down"
    )} or you will not be able to access the server anymore.`
  )
);
adminEmail =
  (await rl.question(
    `What is the admin user's email address? (${chalk.bold(adminEmail)})? `
  )) || adminEmail;
adminPassword =
  (await rl.question(
    `What is the admin user's password? (${chalk.bold(adminPassword)})? `
  )) || adminPassword;

console.log(chalk.yellow.bold(`\n\n-----Geolocation-----`));
console.log(
  chalk.yellow(
    "This is optional, but it will allow your server to do geolocation and your users to tag posts and media with their location. You can get a free API key with 25K daily requests from https://geocode.maps.co. Leave these fields blank not to use it."
  )
);
geocodingApiKey =
  (await rl.question(`What is your Geocoding (geocode.maps.co) API key? `)) ||
  geocodingApiKey;
let locationName = await rl.question(`What is your location (${location})? `);
if (locationName) {
  console.log("Searching for location...");
  try {
    let req = await fetch(
      `https://geocode.maps.co/search?q=${locationName}&api_key=${geocodingApiKey}`
    );
    let locations = await req.json();

    console.log("Please choose your correct location: ");

    for (let i = 0; i < locations.length; i++) {
      console.log(`${i + 1}. ${locations[i].display_name}`);
    }
    let whichLocation =
      (await rl.question(`Enter the correct number? (1) `)) || 1;

    defaultSettings.location = {
      name: locationName,
      type: "Place",
      latitude: locations[whichLocation - 1].lat,
      longitude: locations[whichLocation - 1].lon,
    };
  } catch (e) {
    console.log(e);
  }
}
console.log(defaultSettings);

let env = `MONGODB_URI="${dbUrl}"
JWT_KEY="${jwtKey}"
PORT=${port}`;
try {
  await fs.writeFile(`./${envFile}`, env);
} catch (e) {
  console.log(e);
}

try {
  await fs.writeFile(
    `./config/defaultSettings.json`,
    JSON.stringify(defaultSettings, null, 2)
  );
} catch (e) {
  console.log(e);
}

process.exit(0);
