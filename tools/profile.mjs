import path from 'node:path';
import { createPrivateProfile } from './lib/private-profile.mjs';
const root=path.resolve(import.meta.dirname,'..');
try{
 const args=process.argv.slice(2),options={root};
 while(args.length){const key=args.shift();if(!['--client','--input','--output'].includes(key)||!args.length)throw new Error('Usage: npm run profile -- --client CLIENT --input private/input.json --output private/profile.conf');options[{'--client':'client','--input':'inputFile','--output':'outputFile'}[key]]=args.shift();}
 const result=await createPrivateProfile(options);
 process.stdout.write(`Generated private ${result.client} profile (${result.counts.nodes} local/imported nodes, ${result.counts.subscriptions} subscriptions). Credentials and subscription URLs are omitted.\n`);
}catch(error){process.stderr.write(`${error.message}\n`);process.exitCode=1;}
