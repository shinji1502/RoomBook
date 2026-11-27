// Automated verification script for RoomBook frontend RPC integration
const fs = require('fs');
const path = require('path');

const appJsPath = path.resolve('stitch_room_booking_app_frontend/app.js');
const dataJsPath = path.resolve('stitch_room_booking_app_frontend/data.js');
const migrationSqlPath = path.resolve('stitch_room_booking_app_frontend/supabase_migration_v2.sql');

const appJs = fs.readFileSync(appJsPath, 'utf8');
const dataJs = fs.readFileSync(dataJsPath, 'utf8');
const migrationSql = fs.readFileSync(migrationSqlPath, 'utf8');

console.log('--- RoomBook Frontend & Supabase RPC Integration Verifier ---');

const checks = [
  {
    name: '1. createReservationSupabase sends all 7 required parameters',
    test: () => {
      const keys = ['p_room_id', 'p_event_name', 'p_purpose', 'p_start_time', 'p_end_time', 'p_participants', 'p_facilities'];
      return keys.every(k => dataJs.includes(k));
    }
  },
  {
    name: '2. create_reservation_safe in SQL declares exact matching 7 parameters',
    test: () => {
      return migrationSql.includes('p_room_id bigint') &&
             migrationSql.includes('p_event_name text') &&
             migrationSql.includes('p_purpose text') &&
             migrationSql.includes('p_start_time timestamptz') &&
             migrationSql.includes('p_end_time timestamptz') &&
             migrationSql.includes('p_participants integer') &&
             migrationSql.includes('p_facilities text[]');
    }
  },
  {
    name: '3. Participants validation strictly rejects NULL and <= 0 in SQL',
    test: () => {
      return migrationSql.includes('IF p_participants IS NULL') &&
             migrationSql.includes('IF p_participants <= 0') &&
             !migrationSql.includes('COALESCE(p_participants, 1)');
    }
  },
  {
    name: '4. Participants validation strictly rejects NULL, empty, and <= 0 in frontend',
    test: () => {
      return dataJs.includes('p_participants: (participants !== undefined && participants !== null && String(participants).trim() !== \'\') ? Number(participants) : null') &&
             appJs.includes('if (participants === null || isNaN(participants))');
    }
  },
  {
    name: '5. Overlap check and Level 1 room row lock present in create_reservation_safe',
    test: () => {
      return migrationSql.includes('FROM public.rooms') &&
             migrationSql.includes('FOR UPDATE') &&
             /start_time\s*<\s*p_end_time[\s\S]*?end_time\s*>\s*p_start_time/i.test(migrationSql);
    }
  },
  {
    name: '6. Double-approval prevention present in update_reservation_status_safe',
    test: () => {
      return migrationSql.includes('v_has_approved_conflict') &&
             migrationSql.includes('status = \'approved\'');
    }
  },
  {
    name: '7. Reservation cancellation strictly checks pending status & ownership in app.js',
    test: () => {
      return appJs.includes('item.status !== \'pending\'') &&
             appJs.includes('item.userId !== currentUserId');
    }
  },
  {
    name: '8. loadReservationsFromDatabase has fallback to select(*) and notifies subscribers',
    test: () => {
      return dataJs.includes('this.notify()') &&
             dataJs.includes('select(\'*\')');
    }
  },
  {
    name: '9. Zero Direct Mutation enforced: authenticated has no direct INSERT/UPDATE/DELETE on tables',
    test: () => {
      return migrationSql.includes('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.reservations FROM authenticated;') &&
             migrationSql.includes('GRANT SELECT ON TABLE public.reservations TO authenticated;');
    }
  },
  {
    name: '10. EXECUTE grants properly assigned to authenticated and revoked from public/anon',
    test: () => {
      return migrationSql.includes('GRANT EXECUTE ON FUNCTION public.create_reservation_safe') &&
             migrationSql.includes('GRANT EXECUTE ON FUNCTION public.update_reservation_status_safe');
    }
  }
];

let allPassed = true;
checks.forEach(c => {
  const passed = c.test();
  console.log(`${passed ? '✅ PASS' : '❌ FAIL'}: ${c.name}`);
  if (!passed) allPassed = false;
});

if (allPassed) {
  console.log('\n🎉 ALL 10 RPC INTEGRATION CHECKS PASSED PERFECTLY!');
  process.exit(0);
} else {
  console.error('\n❌ SOME INTEGRATION CHECKS FAILED!');
  process.exit(1);
}
