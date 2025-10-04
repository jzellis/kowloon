import { jwtVerify, createRemoteJWKSet } from "jose";
import getSettings from "#methods/settings/get.js";

const verifyUserJwt = async function (
  token,
  { expectedIssuer, expectedAudience }
) {
  let settings = await getSettings();
  const jwks =
    expectedIssuer === `https://${process.env.DOMAIN}`
      ? undefined // local verify with your in-memory key if you prefer
      : createRemoteJWKSet(new URL(`${expectedIssuer}/.well-known/jwks.json`));

  if (jwks) {
    const { payload } = await jwtVerify(token, jwks, {
      algorithms: ["RS256"],
      issuer: expectedIssuer,
      audience: expectedAudience,
      clockTolerance: 60,
    });
    return payload;
  } else {
    // Local verification - use your loaded public key material
    const { payload } = await jwtVerify(token, settings.publicKey, {
      algorithms: ["RS256"],
      issuer: expectedIssuer,
      audience: expectedAudience,
      clockTolerance: 60,
    });
    return payload;
  }
};

export default verifyUserJwt;
