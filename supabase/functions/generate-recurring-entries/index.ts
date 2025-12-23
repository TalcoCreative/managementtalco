import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const today = new Date()
    const currentDay = today.getDate()
    const currentMonth = today.getMonth() + 1
    const currentYear = today.getFullYear()
    const todayStr = today.toISOString().split('T')[0]

    console.log(`Running recurring entries generation for ${todayStr}, day: ${currentDay}`)

    // Get all active recurring items where due_day matches today
    const { data: recurringItems, error: fetchError } = await supabase
      .from('recurring_budget')
      .select('*')
      .eq('status', 'active')
      .eq('due_day', currentDay)
      .lte('start_date', todayStr)

    if (fetchError) {
      console.error('Error fetching recurring items:', fetchError)
      throw fetchError
    }

    console.log(`Found ${recurringItems?.length || 0} recurring items for today`)

    let generatedCount = 0

    for (const item of recurringItems || []) {
      // Check if end_date has passed
      if (item.end_date && new Date(item.end_date) < today) {
        console.log(`Skipping ${item.name} - end_date passed`)
        continue
      }

      // Check period - for monthly, generate every month
      // For quarterly, only generate every 3 months from start
      // For yearly, only generate on the same month as start
      const startDate = new Date(item.start_date)
      const startMonth = startDate.getMonth() + 1
      
      let shouldGenerate = false
      
      if (item.period === 'monthly') {
        shouldGenerate = true
      } else if (item.period === 'quarterly') {
        const monthsDiff = (currentYear - startDate.getFullYear()) * 12 + (currentMonth - startMonth)
        shouldGenerate = monthsDiff >= 0 && monthsDiff % 3 === 0
      } else if (item.period === 'yearly') {
        shouldGenerate = currentMonth === startMonth
      } else if (item.period === 'custom' && item.custom_days) {
        const daysDiff = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        shouldGenerate = daysDiff >= 0 && daysDiff % item.custom_days === 0
      }

      if (!shouldGenerate) {
        console.log(`Skipping ${item.name} - period check failed`)
        continue
      }

      // Check if entry already exists for this month
      if (item.type === 'expense') {
        const { data: existing } = await supabase
          .from('expenses')
          .select('id')
          .eq('recurring_id', item.id)
          .gte('created_at', `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`)
          .lt('created_at', currentMonth === 12 
            ? `${currentYear + 1}-01-01` 
            : `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`)
          .limit(1)

        if (existing && existing.length > 0) {
          console.log(`Skipping ${item.name} - expense already exists for this month`)
          continue
        }

        // Create expense entry
        const { error: insertError } = await supabase
          .from('expenses')
          .insert({
            description: `${item.name} - ${getMonthName(currentMonth)} ${currentYear}`,
            amount: item.amount,
            category: 'Operasional',
            status: 'pending',
            created_by: item.created_by,
            is_recurring: true,
            recurring_id: item.id,
            client_id: item.client_id,
            project_id: item.project_id,
          })

        if (insertError) {
          console.error(`Error creating expense for ${item.name}:`, insertError)
        } else {
          console.log(`Created expense for ${item.name}`)
          generatedCount++
        }
      } else if (item.type === 'income') {
        const { data: existing } = await supabase
          .from('income')
          .select('id')
          .eq('recurring_id', item.id)
          .gte('created_at', `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`)
          .lt('created_at', currentMonth === 12 
            ? `${currentYear + 1}-01-01` 
            : `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`)
          .limit(1)

        if (existing && existing.length > 0) {
          console.log(`Skipping ${item.name} - income already exists for this month`)
          continue
        }

        // Create income entry
        const { error: insertError } = await supabase
          .from('income')
          .insert({
            source: item.name,
            amount: item.amount,
            type: 'recurring',
            date: todayStr,
            status: 'pending',
            created_by: item.created_by,
            recurring_id: item.id,
            client_id: item.client_id,
            project_id: item.project_id,
          })

        if (insertError) {
          console.error(`Error creating income for ${item.name}:`, insertError)
        } else {
          console.log(`Created income for ${item.name}`)
          generatedCount++
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Generated ${generatedCount} entries`,
        date: todayStr,
        day: currentDay
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in generate-recurring-entries:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function getMonthName(month: number): string {
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
                  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  return months[month - 1]
}
