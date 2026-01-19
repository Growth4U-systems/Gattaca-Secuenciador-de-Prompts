import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkClients() {
  // Get all users
  const { data: users } = await supabase
    .from('auth.users')
    .select('id, email')

  // Get users from auth.users via admin
  const { data: authUsers } = await supabase.auth.admin.listUsers()

  console.log('Auth users:')
  authUsers?.users.forEach(u => {
    console.log(`  - ${u.email} (${u.id})`)
  })

  // Check if martin user is in Growth4U agency
  const martinId = '027dd02c-29ba-4539-8222-2f3203c7eeff'
  const growth4uAgencyId = '5cdbd871-8572-4084-b152-79f0eff3fc71'

  const { data: membership } = await supabase
    .from('agency_members')
    .select('*')
    .eq('user_id', martinId)
    .eq('agency_id', growth4uAgencyId)
    .single()

  console.log('\nMartin membership in Growth4U:', membership)
}

checkClients()
