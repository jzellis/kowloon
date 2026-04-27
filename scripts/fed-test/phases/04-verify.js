// Phase 4: Print the verification report from state.federation.results

export async function runPhase4(state) {
  console.log('\n=== Phase 4: Verification Report ===\n');

  const results = state.federation.results || [];
  if (!results.length) {
    console.log('No results recorded.');
    return;
  }

  const byType = {};
  for (const r of results) {
    if (!byType[r.type]) byType[r.type] = { pass: 0, fail: 0, items: [] };
    byType[r.type][r.status]++;
    byType[r.type].items.push(r);
  }

  const totalPass = results.filter(r => r.status === 'pass').length;
  const totalFail = results.filter(r => r.status === 'fail').length;
  const total = results.length;

  // Summary by type
  console.log('Results by type:');
  console.log('─'.repeat(72));
  for (const [type, data] of Object.entries(byType)) {
    const pct = total ? Math.round((data.pass / (data.pass + data.fail)) * 100) : 0;
    const bar = `${data.pass} pass, ${data.fail} fail`;
    console.log(`  ${type.padEnd(25)} ${bar.padEnd(22)} (${pct}%)`);

    // Show timing stats for passing results
    const passTimes = data.items.filter(r => r.status === 'pass').map(r => r.ms);
    if (passTimes.length) {
      const avg = Math.round(passTimes.reduce((a, b) => a + b, 0) / passTimes.length);
      const max = Math.max(...passTimes);
      console.log(`  ${''.padEnd(25)} avg delivery: ${avg}ms, max: ${max}ms`);
    }
  }

  console.log('─'.repeat(72));
  console.log(`  TOTAL: ${totalPass}/${total} passed  (${Math.round((totalPass / total) * 100)}%)`);

  // Failures detail
  const failures = results.filter(r => r.status === 'fail');
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) {
      console.log(`  FAIL  [${f.type}] ${f.actor} → ${f.target || f.toServer}  (${f.error})`);
    }
  } else {
    console.log('\nAll federation checks passed.');
  }

  console.log('');
}
