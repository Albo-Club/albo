import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UnipileEmail {
  id: string
  account_id: string
  subject: string
  from: {
    display_name: string
    identifier: string
  }
  to: Array<{
    display_name: string
    identifier: string
  }>
  cc?: Array<{
    display_name: string
    identifier: string
  }>
  date: string
  read: boolean
  has_attachments: boolean
  folders: string[]
  body?: string
  body_plain?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
    const UNIPILE_API_KEY = Deno.env.get('UNIPILE_API_KEY')
    const UNIPILE_DSN = Deno.env.get('UNIPILE_DSN')

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Missing Supabase environment variables')
    }

    if (!UNIPILE_API_KEY || !UNIPILE_DSN) {
      throw new Error('Missing Unipile environment variables')
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Create Supabase client with user's token
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('Auth error:', userError)
      throw new Error('Unauthorized')
    }

    console.log('Fetching emails for user:', user.id)

    // Parse request body for optional parameters
    let limit = 50
    let folder = 'INBOX'
    let role = 'all'

    try {
      const body = await req.json()
      if (body.limit) limit = Math.min(body.limit, 100)
      if (body.folder) folder = body.folder
      if (body.role) role = body.role
    } catch {
      // No body or invalid JSON, use defaults
    }

    // Fetch active email accounts for this user
    const { data: accounts, error: accountsError } = await supabase
      .from('connected_accounts')
      .select('id, provider_account_id, email, display_name, provider, status')
      .eq('user_id', user.id)
      .eq('channel_type', 'email')
      .eq('status', 'active')

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError)
      throw new Error('Failed to fetch connected accounts')
    }

    if (!accounts || accounts.length === 0) {
      console.log('No active email accounts found')
      return new Response(
        JSON.stringify({ success: true, emails: [], accounts: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${accounts.length} active email account(s)`)

    // Fetch emails from each account
    const allEmails: UnipileEmail[] = []

    for (const account of accounts) {
      try {
        console.log(`Fetching emails for account: ${account.email} (${account.provider_account_id})`)

        const params = new URLSearchParams({
          account_id: account.provider_account_id,
          limit: limit.toString(),
          role: role,
        })

        // Only add folder if it's not 'all'
        if (folder && folder !== 'all') {
          params.append('folder', folder)
        }

        const unipileUrl = `https://${UNIPILE_DSN}/api/v1/emails?${params.toString()}`
        console.log('Calling Unipile API:', unipileUrl)

        const response = await fetch(unipileUrl, {
          method: 'GET',
          headers: {
            'X-API-KEY': UNIPILE_API_KEY,
            'accept': 'application/json',
          },
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`Unipile API error for account ${account.email}:`, response.status, errorText)
          continue // Skip this account but continue with others
        }

        const data = await response.json()
        console.log(`Received ${data.items?.length || 0} emails from account ${account.email}`)

        if (data.items && Array.isArray(data.items)) {
          // Add account info to each email for reference
          const emailsWithAccount = data.items.map((email: UnipileEmail) => ({
            ...email,
            _account_id: account.id,
            _account_email: account.email,
          }))
          allEmails.push(...emailsWithAccount)
        }
      } catch (err) {
        console.error(`Error fetching emails for account ${account.email}:`, err)
        // Continue with other accounts
      }
    }

    // Sort all emails by date (newest first)
    allEmails.sort((a, b) => {
      const dateA = new Date(a.date).getTime()
      const dateB = new Date(b.date).getTime()
      return dateB - dateA
    })

    console.log(`Total emails fetched: ${allEmails.length}`)

    return new Response(
      JSON.stringify({
        success: true,
        emails: allEmails,
        accounts: accounts.map(a => ({
          id: a.id,
          email: a.email,
          display_name: a.display_name,
          provider: a.provider,
          status: a.status,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in fetch-unipile-emails:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: error instanceof Error && error.message === 'Unauthorized' ? 401 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
