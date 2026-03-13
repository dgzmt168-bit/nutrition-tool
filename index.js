'use strict';

const https = require('https');

// 阿里云函数计算入口
exports.handler = async (event, context) => {
  // 解析请求
  const request = JSON.parse(event.toString());
  const method = request.method || 'GET';
  const path = request.path || '/';
  const headers = request.headers || {};
  const body = request.body ? JSON.parse(request.body) : {};

  // 统一跨域响应头
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-access-code',
    'Content-Type': 'application/json'
  };

  // 处理预检请求
  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  // 只处理 POST /api/chat
  if (method !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // 验证访问码
  const accessCode = headers['x-access-code'] || headers['X-Access-Code'];
  const validCode = process.env.ACCESS_CODE;
  if (validCode && accessCode !== validCode) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: '访问码错误，请联系管理员获取' })
    };
  }

  // 调用 Anthropic API
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: '服务器配置错误，请联系管理员' })
    };
  }

  const { messages, system } = body;
  const payload = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: system || '',
    messages: messages || []
  });

  try {
    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.anthropic.com',
        port: 443,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch(e) { reject(new Error('API响应解析失败')); }
        });
      });

      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(result)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: '服务器错误：' + error.message })
    };
  }
};
