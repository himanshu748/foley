// Ephemeral HTTPS server for the emulator. No tunnel, cloud account or user data.
import {createServer} from 'node:https';
import {readFileSync} from 'node:fs';
import {createApp} from '../server/index.mjs';
process.env.PUBLIC_URL='https://10.0.2.2:4443';
const runtime=await createApp({database:':memory:'});
createServer({key:readFileSync('.ci/server.key'),cert:readFileSync('.ci/server.crt')},runtime.app)
  .listen(4443,'0.0.0.0',()=>console.log('Ephemeral Foley TV test server listening on 4443'));
