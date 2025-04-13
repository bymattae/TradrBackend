
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// MetaApi config
const metaapi = require('metaapi.cloud-sdk').default;
const token = process.env.METAAPI_TOKEN;
const api = new metaapi(token);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(req, { params }) {
  const strategyId = params.strategyId;

  // 1. Get login credentials from Supabase
  const { data: account, error } = await supabase
    .from('linked_accounts')
    .select('*')
    .eq('strategy_id', strategyId)
    .single();

  if (error || !account) {
    return NextResponse.json({ error: 'Linked account not found' }, { status: 404 });
  }

  const { login, password, server, platform } = account;

  try {
    // 2. Connect to MetaApi
    const connection = await api.connect();
    const account = await api.provisioningApi.getAccount(login);

    await account.deploy();
    await account.waitConnected();

    const metrics = await account.getMetrics();

    // 3. Store metrics in Supabase
    await supabase.from('strategy_stats').upsert({
      strategy_id: strategyId,
      metrics,
      synced_at: new Date().toISOString()
    }, { onConflict: 'strategy_id' });

    return NextResponse.json({ success: true, metrics });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'MetaApi error', details: err.message }, { status: 500 });
  }
}
