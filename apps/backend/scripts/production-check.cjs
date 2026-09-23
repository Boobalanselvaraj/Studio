const env=require('../src/config/env');
const failures=[];
for(const key of ['JWT_SECRET','SESSION_SECRET','INTERNAL_SERVICE_KEY','CREDENTIAL_ENCRYPTION_KEY']){const value=process.env[key]||'';if(value.length<32 || /replace|change_me|dev_|super_secret/.test(value))failures.push(key+' must be a unique strong secret');}
if(!/^https:\/\//.test(env.APP_URL))failures.push('APP_URL must use HTTPS');
if(failures.length){console.error(failures.join('\n'));process.exit(1);}console.log('Production environment checks passed');
