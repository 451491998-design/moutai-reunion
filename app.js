const form = document.getElementById('inviteForm');
const message = document.getElementById('formMessage');
const button = form.querySelector('button[type="submit"]');
const requestId = crypto.randomUUID();
let busy = false;
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !form.reportValidity()) return;
  message.textContent = '';
  if (location.protocol === 'file:') { message.textContent = '当前为本地预览，请打开发布后的活动链接提交登记。'; return; }
  const values = new FormData(form);
  busy = true; button.disabled = true; button.textContent = '正在提交…';
  form.setAttribute('aria-busy', 'true');
  try {
    const endpoint = new URL('/api/registrations', form.dataset.apiBase || location.origin);
    const response = await fetch(endpoint, { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId, name: values.get('name'), phone: values.get('phone'), company: values.get('company'), guests: Number(values.get('guests')), note: values.get('note'), consent: values.get('consent') === 'on', website: values.get('website') || '' }), signal: AbortSignal.timeout(20000) });
    const result = await response.json();
    if (!response.ok || result.ok !== true) throw new Error(result.error || '提交未完成，请稍后重试。');
    form.hidden = true; form.style.display = 'none';
    const success = document.getElementById('success');
    success.classList.add('show'); success.focus();
  } catch (error) {
    message.textContent = error.name === 'TimeoutError' || error instanceof TypeError ? '暂时无法确认提交结果。请检查网络后重试，重复点击不会重复登记。' : error.message;
  } finally {
    busy = false; button.disabled = false; button.textContent = '提交登记'; form.removeAttribute('aria-busy');
  }
});
if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  addEventListener('pagehide', () => lifecycle.abort(), { once: true });
  try {
    Promise.resolve(document.modelContext.registerTool({
      name: 'prepare_event_registration',
      title: '填写活动登记草稿',
      description: '填写并展示登记草稿，供来宾检查；不勾选信息授权，也不提交或保存登记。',
      annotations: {readOnlyHint:false,untrustedContentHint:false},
      inputSchema: {type:'object',properties:{name:{type:'string',minLength:1,maxLength:60},phone:{type:'string',pattern:'^1[0-9]{10}$'},company:{type:'string',maxLength:150},guests:{type:'integer',enum:[1,2,3,4]},note:{type:'string',maxLength:500}},required:['name','phone','guests'],additionalProperties:false},
      execute(input) {
        if (busy || form.hidden) throw new Error('登记当前不可编辑。');
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k=>!['name','phone','company','guests','note'].includes(k)) || typeof input.name !== 'string' || !input.name.trim() || input.name.length>60 || typeof input.phone !== 'string' || !/^1\d{10}$/.test(input.phone) || ![1,2,3,4].includes(input.guests) || (input.company!==undefined&&(typeof input.company!=='string'||input.company.length>150)) || (input.note!==undefined&&(typeof input.note!=='string'||input.note.length>500))) throw new Error('请提供有效的姓名、手机号和出席人数。');
        for (const key of ['name','phone','company','guests','note']) form.elements.namedItem(key).value = input[key] ?? '';
        form.elements.namedItem('consent').checked = false;
        form.scrollIntoView({block:'center'});
        return {status:'draft_ready',saved:false,requiresConsentAndSubmission:true};
      }
    },{signal:lifecycle.signal})).catch(()=>{});
  } catch {}
}
