import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const METAAPI_TOKEN = process.env.METAAPI_TOKEN;

export default async function connect(req, res) {
  const { strategyId } = req.params;
  const { login, password, server, platform } = req.body;

  try {
    const createRes = await axios.post(
      'https://mt-provisioning-api-v1.agiliumtrade.ai/users/current/accounts',
      {
        name: `strategy-${strategyId}`,
        login,
        password,
        server,
        platform,
        type: 'cloud'
      },
      { headers: { Authorization: `Bearer ${METAAPI_TOKEN}` } }
    );

    const accountId = createRes.data.id;
    let deployed = false;
    let retries = 0;

    while (!deployed && retries < 10) {
      const check = await axios.get(
        `https://mt-provisioning-api-v1.agiliumtrade.ai/users/current/accounts/${accountId}`,
        {
          headers: { Authorization: `Bearer ${METAAPI_TOKEN}` }
        }
      );

      if (check.data.state === 'DEPLOYED') {
        deployed = true;
      } else {
        await new Promise((r) => setTimeout(r, 5000));
        retries++;
      }
    }

    if (!deployed) return res.status(408).json({ error: 'MetaApi deployment timed out.' });

    const metricsRes = await axios.get(
      `https://metastats-api-v1.agiliumtrade.ai/users/current/accounts/${accountId}/metrics`,
      {
        headers: { Authorization: `Bearer ${METAAPI_TOKEN}` }
      }
    );

    const metrics = metricsRes.data;

    const { error } = await supabase.from('strategy_stats').upsert({
      strategy_id: strategyId,
      account_id: accountId,
      profit_percentage: metrics.profitPercentage,
      win_rate: metrics.winRate,
      total_trades: metrics.totalTrades,
      max_drawdown: metrics.maxDrawdown,
      avg_rr: metrics.avgRr,
      synced_at: new Date()
    });

    if (error) return res.status(500).json({ error: error.message });

    res.status(200).json({
      success: true,
      strategy_id: strategyId,
      account_id: accountId,
      metrics
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({
      error: err.response?.data || err.message
    });
  }
}