function assertEq(a, b, name) {
  if (String(a) !== String(b)) {
    console.error('FAIL', name, a, b);
    return false;
  }
  console.log('PASS', name);
  return true;
}

async function run() {
  await updateOrgDisplay();
  const el = document.getElementById('menuOrg');
  assertEq(el.textContent, '暂未加入担保组织', 'initial empty');

  const g = { type: 'join', groupID: '12345678', aggreNode: 'aggre', assignNode: 'assign', pledgeAddress: 'pledge' };
  localStorage.setItem('guarChoice', JSON.stringify(g));
  await updateOrgDisplay();
  assertEq(el.textContent, '12345678', 'after join');

  const u = loadUser() || {};
  u.guarGroup = { groupID: '99999999' };
  saveUser(u);
  await updateOrgDisplay();
  assertEq(el.textContent, '99999999', 'sync from user');
}
run();
