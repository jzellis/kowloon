import Kowloon from "../../Kowloon.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let page = `
    <!doctype html>
    <html>
        <head>
            <title>Kowloon | Setup</title>
                <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
            <link href="https://cdn.jsdelivr.net/npm/daisyui@5" rel="stylesheet" type="text/css" />
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
        </head>
        <body>
        <div class="container-fluid w-4/5 mx-auto my-8">
            <h1 class="text-3xl text-center">Kowloon | Setup</h1>
        <form class="my-8" action="/setup" method="post">
            <fieldset>            <fieldset>
                <legend class="fieldset-legend">
                        Community Name
                </legend>
                <input type="text" class="input" id="title" name="title" placeholder="My Kowloon Server" />
            </fieldset>
            <fieldset>
                <legend class="fieldset-legend">
                        Description
                </legend>
                <textarea class="textarea h-8" id="description" name="description" placeholder="This is my Kowloon server. There are many like it but this one is mine."></textarea>
            </fieldset>

            </form>
            </div>
            </body>
    </html>
    `;
  let response = {
    queryTime: Date.now() - qStart,
  };
  res.status(status).send(page);
}
