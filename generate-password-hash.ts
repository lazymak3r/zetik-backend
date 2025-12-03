import { PasswordUtil } from './libs/common/src/utils/password.util';

async function generateHash() {
  const password = 'changeme1234';
  const hash = await PasswordUtil.hash(password);

  console.log('\n=================================');
  console.log('Password:', password);
  console.log('=================================');
  console.log('Hash:', hash);
  console.log('=================================\n');
}

generateHash().catch(console.error);
