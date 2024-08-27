import crypto from "crypto";

export default async function (actorId, publicKey) {
  try {
    let [username, server] = actorId.slice(1).split("@"); // This splits their Kowloon id (i.e. "@alice@kowloon.social") into their username and home server
    let key = crypto.randomBytes(20).toString("hex"); // This is the random string we create to verify with the user's public and private keys
    let encrypted = crypto.publicEncrypt(publicKey, key); // We encrypt our string with their public key

    let url = `https://${server}/users/${username}`; // This gets a URL at their home server to retrieve their profile
    let userProfile = await (await fetch(url)).json(); // This goes to the user's server and retrieves their public key from their profile
    if (userProfile.user?.id && publicKey == userProfile.user.keys.public) {
      // let publicKey = userProfile.user.keys.public; // This gets the user at that address's public key
      // //   console.log(encrypted);
      let verifyBody = {
        actor: actorId,
        key: encrypted,
      };
      let verifyUrl = `https://${server}/verify`;
      let result = await (
        await fetch(verifyUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(verifyBody),
        })
      ).text();
      return key == result; // simply returns true if the user's public key matches the encrypted string
    } else {
      return false;
    }
  } catch (e) {
    console.error(e);
    return false;
  }
}
