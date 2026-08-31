import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  ScatterChart, Scatter, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Treemap, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ZAxis,
} from 'recharts';
import './AiRichText.css';

const COLORS = ['#6C3CE1', '#EC4899', '#60A5FA', '#34D399', '#FBBF24', '#F97316', '#22D3EE'];

function parseJsonSafe(raw) {
  try { return JSON.parse(String(raw).trim()); } catch { return null; }
}

function toRows(spec) {
  if (Array.isArray(spec.points)) return spec.points;
  if (Array.isArray(spec.series) && Array.isArray(spec.labels)) {
    return spec.labels.map((label, i) => {
      const row = { name: label };
      spec.series.forEach((s, si) => {
        row[s.name || `s${si}`] = Number((s.data || [])[i]) || 0;
      });
      return row;
    });
  }
  const labels = spec.labels || [];
  const data = spec.data || [];
  return labels.map((name, i) => ({ name, value: Number(data[i]) || 0 }));
}

function ChartBlock({ spec }) {
  if (!spec) return null;
  const type = String(spec.type || 'column').toLowerCase();
  const rows = toRows(spec);
  const title = spec.title || '';

  const wrap = (child) => (
    <div className="ai-chart">
      {title ? <div className="ai-chart-title">{title}</div> : null}
      <div className="ai-chart-body">{child}</div>
    </div>
  );

  if (type === 'pie' || type === 'donut') {
    return wrap(
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={rows} dataKey="value" nameKey="name" innerRadius={type === 'donut' ? 55 : 0} outerRadius={80}>
            {rows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'line' || type === 'sparkline') {
    const h = type === 'sparkline' ? 72 : 220;
    return wrap(
      <ResponsiveContainer width="100%" height={h}>
        <LineChart data={rows}>
          {type !== 'sparkline' && <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.2)" />}
          {type !== 'sparkline' && <XAxis dataKey="name" />}
          {type !== 'sparkline' && <YAxis />}
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#6C3CE1" strokeWidth={2} dot={type !== 'sparkline'} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'area') {
    return wrap(
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.2)" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Area type="monotone" dataKey="value" stroke="#6C3CE1" fill="rgba(108,60,225,0.28)" />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'scatter' || type === 'bubble') {
    const pts = rows.map((r, i) => ({
      x: Number(r.x ?? r.name ?? i),
      y: Number(r.y ?? r.value ?? 0),
      z: Number(r.z ?? r.size ?? 80),
    }));
    return wrap(
      <ResponsiveContainer width="100%" height={220}>
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="x" type="number" />
          <YAxis dataKey="y" type="number" />
          {type === 'bubble' && <ZAxis dataKey="z" range={[40, 220]} />}
          <Tooltip />
          <Scatter data={pts} fill="#6C3CE1" />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'radar') {
    return wrap(
      <ResponsiveContainer width="100%" height={240}>
        <RadarChart data={rows}>
          <PolarGrid />
          <PolarAngleAxis dataKey="name" />
          <PolarRadiusAxis />
          <Radar dataKey="value" stroke="#6C3CE1" fill="#6C3CE1" fillOpacity={0.35} />
          <Tooltip />
        </RadarChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'treemap') {
    return wrap(
      <ResponsiveContainer width="100%" height={220}>
        <Treemap data={rows.map((r) => ({ name: r.name, size: r.value }))} dataKey="size" stroke="#fff" fill="#6C3CE1" />
      </ResponsiveContainer>
    );
  }

  if (type === 'funnel') {
    const max = Math.max(...rows.map((r) => r.value), 1);
    return wrap(
      <div className="ai-funnel">
        {rows.map((r, i) => (
          <div key={r.name} className="ai-funnel-row" style={{ width: `${Math.max(28, (r.value / max) * 100)}%`, background: COLORS[i % COLORS.length] }}>
            {r.name} · {r.value}
          </div>
        ))}
      </div>
    );
  }

  if (type === 'stacked' && spec.series) {
    return wrap(
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          {spec.series.map((s, i) => (
            <Bar key={s.name || i} dataKey={s.name || `s${i}`} stackId="a" fill={COLORS[i % COLORS.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  const layout = type === 'bar' ? 'vertical' : 'horizontal';
  return wrap(
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={rows} layout={layout === 'vertical' ? 'vertical' : 'horizontal'}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.2)" />
        {layout === 'vertical' ? (
          <>
            <XAxis type="number" />
            <YAxis type="category" dataKey="name" width={70} />
          </>
        ) : (
          <>
            <XAxis dataKey="name" />
            <YAxis />
          </>
        )}
        <Tooltip />
        <Bar dataKey="value" fill="#6C3CE1" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function CodeBlock({ code, onCopy }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="ai-code-wrap">
      <button
        type="button"
        className="ai-copy"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          } catch (_) {}
          onCopy?.();
        }}
        title="Copy"
      >
        <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`} />
      </button>
      <pre className="ai-code"><code>{code}</code></pre>
    </div>
  );
}

function extractFollowups(text) {
  const found = [];
  let body = text;
  const fence = text.match(/```followups\s*([\s\S]*?)```/i);
  if (fence) {
    body = body.replace(fence[0], '');
    const parsed = parseJsonSafe(fence[1]);
    if (Array.isArray(parsed)) found.push(...parsed);
  }
  const lineRe = /^(?:👉|➡️)?\s*(?:Tap to explore:\s*)?(.+\?)\s*$/gim;
  body = body.replace(lineRe, (_, q) => {
    found.push(q.trim());
    return '';
  });
  return { body: body.trim(), followups: [...new Set(found)].slice(0, 3) };
}

function extractCharts(text) {
  const charts = [];
  let body = text.replace(/```chart\s*([\s\S]*?)```/gi, (_, raw) => {
    const spec = parseJsonSafe(raw);
    if (spec) charts.push(spec);
    return '';
  });
  return { body, charts };
}

function mergeWebFences(text) {
  const blocks = [];
  const re = /```(html|css|js|javascript|web)\s*([\s\S]*?)```/gi;
  let last = 0;
  let m;
  const parts = [];
  while ((m = re.exec(text))) {
    parts.push({ start: m.index, end: re.lastIndex, lang: m[1].toLowerCase(), code: m[2].trim() });
  }
  if (!parts.length) return text;
  let out = '';
  let i = 0;
  last = 0;
  while (i < parts.length) {
    out += text.slice(last, parts[i].start);
    const group = [parts[i]];
    let j = i + 1;
    while (j < parts.length && parts[j].start - parts[j - 1].end < 8) {
      group.push(parts[j]);
      j += 1;
    }
    if (group.length > 1 || group[0].lang === 'web') {
      const combined = group.map((g) => {
        if (g.lang === 'web') return g.code;
        const tag = g.lang === 'javascript' ? 'js' : g.lang;
        return `/* ${tag} */\n${g.code}`;
      }).join('\n\n');
      out += `\n\n\`\`\`web\n${combined}\n\`\`\`\n\n`;
    } else {
      out += text.slice(parts[i].start, parts[i].end);
    }
    last = group[group.length - 1].end;
    i = j;
  }
  out += text.slice(last);
  return out;
}

function preprocess(text = '') {
  let t = String(text);
  t = t.replace(/==([^=]+)==/g, '<mark>$1</mark>');
  t = t.replace(/\|\|([^|]+)\|\|/g, '<span class="ai-spoiler-text">$1</span>');
  t = t.replace(/(^|[^$])\^([A-Za-z0-9+\-]+)\^/g, '$1<sup>$2</sup>');
  t = t.replace(/(^|[^$])~([A-Za-z0-9+\-]+)~/g, '$1<sub>$2</sub>');
  return t;
}

const AiRichText = ({ text, onFollowup }) => {
  const parsed = useMemo(() => {
    const follow = extractFollowups(text || '');
    const charted = extractCharts(follow.body);
    return {
      body: preprocess(mergeWebFences(charted.body)),
      followups: follow.followups,
      charts: charted.charts,
    };
  }, [text]);

  if (!text) return null;

  return (
    <div className="ai-rich">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
        components={{
          code({ inline, className, children }) {
            const raw = String(children).replace(/\n$/, '');
            const lang = (className || '').replace('language-', '');
            if (!inline && lang === 'chart') {
              return <ChartBlock spec={parseJsonSafe(raw)} />;
            }
            if (inline) return <code className="ai-inline-code">{raw}</code>;
            return <CodeBlock code={raw} />;
          },
          mark: ({ children }) => <mark className="ai-highlight">{children}</mark>,
          u: ({ children }) => <u>{children}</u>,
          sub: ({ children }) => <sub>{children}</sub>,
          sup: ({ children }) => <sup>{children}</sup>,
        }}
      >
        {parsed.body}
      </ReactMarkdown>
      {parsed.charts.map((spec, i) => <ChartBlock key={`c${i}`} spec={spec} />)}
      {parsed.followups.length > 0 && (
        <div className="ai-followups">
          {parsed.followups.map((q) => (
            <button key={q} type="button" className="ai-followup" onClick={() => onFollowup?.(q)}>
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AiRichText;
