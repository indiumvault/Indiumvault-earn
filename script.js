const $=id=>document.getElementById(id);
const authDialog=$('authDialog');
let authMode='signin',authClient=null,currentUser=null;
const TURNSTILE_SITE_KEY='0x4AAAAAAFaLnmNCXFgW9MWA';
let turnstileWidgetId=null,captchaToken=null,turnstileLoading=null;
function resetCaptcha(){captchaToken=null;if(window.turnstile&&turnstileWidgetId!==null){try{window.turnstile.reset(turnstileWidgetId)}catch(e){console.warn('Turnstile reset failed',e)}}}
function ensureTurnstile(){
 const container=$('turnstile-container');
 if(!container)return;
 if(window.turnstile){
  if(turnstileWidgetId===null){
   try{
    turnstileWidgetId=window.turnstile.render(container,{
     sitekey:TURNSTILE_SITE_KEY,
     callback:token=>{captchaToken=token;setAuthMessage('')},
     'expired-callback':()=>{captchaToken=null;setAuthMessage('Security check expired. Please complete it again.',true)},
     'error-callback':code=>{captchaToken=null;turnstileWidgetId=null;console.error('Cloudflare Turnstile error code:',code);setAuthMessage('Security check failed'+(code?' (code '+code+')':'')+'. Check the Turnstile site key and allowed hostname, then refresh.',true)}
    });
   }catch(error){
    turnstileWidgetId=null;captchaToken=null;console.error('Turnstile render failed:',error);
    setAuthMessage('Security check could not start. Check the Turnstile site key and allowed hostname, then refresh.',true);
   }
  }
  return;
 }
 if(!turnstileLoading){
  turnstileLoading=new Promise((resolve,reject)=>{
   const existing=document.querySelector('script[data-turnstile-api]');
   if(existing){
    if(existing.dataset.loaded==='true'){resolve();return}
    existing.addEventListener('load',resolve,{once:true});
    existing.addEventListener('error',reject,{once:true});
    return;
   }
   const s=document.createElement('script');
   s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
   s.async=true;s.defer=true;s.dataset.turnstileApi='true';
   s.onload=()=>{s.dataset.loaded='true';resolve()};
   s.onerror=()=>reject(new Error('Turnstile script request failed'));
   document.head.appendChild(s);
  });
 }
 turnstileLoading.then(()=>ensureTurnstile()).catch(error=>{
  turnstileLoading=null;captchaToken=null;console.error('Turnstile script failed to load:',error);
  setAuthMessage('Could not download Cloudflare security check. Open the site in Chrome, disable content blockers for this site, and refresh.',true);
 });
}
function requireCaptchaToken(){if(!captchaToken)throw new Error('Complete the security check before continuing.');return captchaToken;}
let activeTasks=[],activeRewards=[],submissions=[],userRedemptions=[];
const authConfig=window.INDIUMVAULT_SUPABASE;
const isConfigured=authConfig&&typeof authConfig.url==='string'&&typeof authConfig.anonKey==='string'&&authConfig.url.startsWith('https://')&&!authConfig.url.includes('YOUR_PROJECT')&&authConfig.anonKey.length>20&&!authConfig.anonKey.includes('PASTE_');
function show(title,message){$('dialogTitle').textContent=title;$('dialogText').textContent=message;if($('dialog').showModal)$('dialog').showModal();else alert(title+'\\n\\n'+message)}
function setAuthMessage(message,isError=false){const el=$('authMessage');el.textContent=message;el.classList.toggle('error',isError)}
$('togglePassword').addEventListener('click',()=>{const password=$('authPassword');const showPassword=password.type==='password';password.type=showPassword?'text':'password';$('togglePassword').setAttribute('aria-label',showPassword?'Hide password':'Show password');$('togglePassword').setAttribute('aria-pressed',String(showPassword));$('togglePassword').innerHTML=showPassword?'<svg class="password-eye" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"></path><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"></path><path d="M9.9 5.2A10.9 10.9 0 0 1 12 5c6.4 0 10 7 10 7a16.5 16.5 0 0 1-3.1 3.9"></path><path d="M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7a10.8 10.8 0 0 0 4-.8"></path></svg>':'<svg class="password-eye" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle></svg>';});
function renderAuth(){const signedIn=!!currentUser;if($('adminPanel'))$('adminPanel').hidden=true;$('authStatus').textContent=signedIn?'Signed in':'Guest';$('profile').textContent=signedIn?(currentUser.email||'U').slice(0,1).toUpperCase():'G';$('profile').setAttribute('aria-label',signedIn?'Open profile':'Sign in');$('authTitle').textContent=signedIn?'Your profile':authMode==='signup'?'Create account':'Sign in';$('usernameFieldWrap').hidden=signedIn||authMode!=='signup';$('referralFieldWrap').hidden=signedIn||authMode!=='signup';if(!signedIn&&authMode==='signup'){let initialReferral=new URLSearchParams(window.location.search).get('ref');if(!initialReferral){try{initialReferral=sessionStorage.getItem('indiumvault_referral_code')}catch{}}$('authReferralCode').value=/^[A-F0-9]{10}$/i.test(initialReferral||'')?initialReferral.toUpperCase():'';}$('authEmail').type=authMode==='signup'?'email':'text';$('authEmail').autocomplete=authMode==='signup'?'email':'username';$('authEmail').placeholder=authMode==='signup'?'you@example.com':'you@example.com or username';$('accountUid').textContent='';$('profilePanel').hidden=!signedIn;$('authIntro').textContent=signedIn?'Manage your account details and view your points wallet.':'Use your email or username and password to '+(authMode==='signup'?'create an account.':'sign in.');$('authForm').hidden=signedIn;$('authProviders').hidden=signedIn;$('authSwitch').hidden=signedIn;$('authSignout').hidden=!signedIn;$('authSubmit').textContent=authMode==='signup'?'Create account':'Sign in';$('authPassword').autocomplete=authMode==='signup'?'new-password':'current-password';if(signedIn){setAuthMessage('');loadProfileCard().catch(e=>console.error('Profile load failed',e))}}
async function loadProfileCard(){if(!authClient||!currentUser)return;const [profileResult,ledgerResult,referralResult]=await Promise.all([authClient.from('account_profiles').select('support_uid,username,referral_code').eq('user_id',currentUser.id).maybeSingle(),authClient.from('points_ledger').select('amount').eq('user_id',currentUser.id),authClient.rpc('my_referral_count')]);if(profileResult.error)throw profileResult.error;if(ledgerResult.error)throw ledgerResult.error;if(referralResult.error)console.warn('Referral count unavailable',referralResult.error);const p=profileResult.data;if(!p)return;const points=(ledgerResult.data||[]).reduce((sum,row)=>sum+Number(row.amount||0),0);const referralUrl=new URL(window.location.origin+window.location.pathname);referralUrl.searchParams.set('ref',p.referral_code);$('profileInitial').textContent=(p.username||currentUser.email||'U').slice(0,1).toUpperCase();$('profileDisplayName').textContent=p.username?'@'+p.username:'Set your username';$('profileEmail').textContent=currentUser.email||'Signed-in provider account';$('profileUid').textContent=p.support_uid;$('profilePoints').textContent=points.toLocaleString('en-IN');$('profileUsername').value=p.username||'';$('profileReferralCode').value=p.referral_code;$('profileReferralLink').value=referralUrl.toString();const referralCountText=referralResult.error?'Unavailable':Number(referralResult.data||0).toLocaleString('en-IN');if($('profileReferralCount'))$('profileReferralCount').textContent=referralCountText;if($('homeReferralCount'))$('homeReferralCount').textContent=referralCountText;if($('referralStat'))$('referralStat').textContent=referralCountText;$('accountUid').textContent='Support UID: '+p.support_uid;$('points').textContent=points.toLocaleString('en-IN');}
$('usernameForm').addEventListener('submit',async event=>{event.preventDefault();if(!authClient||!currentUser)return;const button=$('usernameForm').querySelector('button');const username=$('profileUsername').value.trim();if(!/^[A-Za-z0-9_.-]{2,24}$/.test(username)){$('profileMessage').textContent='Use 2–24 letters, numbers, dots, underscores or hyphens.';$('profileMessage').classList.add('error');return}button.disabled=true;button.textContent='Saving…';$('profileMessage').classList.remove('error');$('profileMessage').textContent='';try{const {data,error}=await authClient.rpc('set_my_username',{p_username:username});if(error)throw error;$('profileMessage').textContent='Username saved.';await loadProfileCard();renderAuth()}catch(e){$('profileMessage').textContent=e.message||'Could not save username.';$('profileMessage').classList.add('error')}finally{button.disabled=false;button.textContent='Save username'}});
$('copyProfileReferral').addEventListener('click',async()=>{const link=$('profileReferralLink').value;if(!link||link==='Loading…')return;try{await navigator.clipboard.writeText(link);$('profileMessage').classList.remove('error');$('profileMessage').textContent='Referral link copied.'}catch{$('profileReferralLink').focus();$('profileReferralLink').select();$('profileMessage').textContent='Select and copy the link above.'}});
function openAuth(){setAuthMessage('');if(!isConfigured||!window.supabase){setAuthMessage('Authentication is not connected yet. Check config.js and AUTH_SETUP.md.',true)}renderAuth();if(authDialog.showModal)authDialog.showModal();else alert('Please open this site in a modern browser to use the account dialog.');ensureTurnstile()}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function safeHttpUrl(value){try{const url=new URL(String(value??''));return url.protocol==='https:'||url.protocol==='http:'?url.href:''}catch{return ''}}
async function loadAccountData(){
 if(!authClient||!currentUser){if($('adminPanel'))$('adminPanel').hidden=true;activeTasks=[];activeRewards=[];submissions=[];userRedemptions=[];renderMyRedemptions([]);$('points').textContent='0';updateCryptoWithdrawalGate();$('count').textContent='0';$('rewardCount').textContent='0';$('taskList').innerHTML='<p class="muted">Sign in to see tasks available to your account.</p>';$('rewardList').innerHTML='<p class="muted">Sign in to see available rewards.</p>';$('balanceFoot').textContent='Sign in to view your account points';return}
 $('taskList').innerHTML='<p class="muted">Loading tasks…</p>';$('rewardList').innerHTML='<p class="muted">Loading rewards…</p>';
 const [ledgerResult,taskResult,rewardResult,submissionResult,redemptionResult]=await Promise.all([
  authClient.from('points_ledger').select('amount').eq('user_id',currentUser.id),
  authClient.from('tasks').select('id,title,description,category,points,destination_url').eq('is_active',true).order('created_at',{ascending:false}),
  authClient.from('rewards').select('id,title,description,points_cost,reward_type').eq('is_active',true).order('points_cost',{ascending:true}),
  authClient.from('task_submissions').select('id,task_id,status,submitted_at').eq('user_id',currentUser.id).order('submitted_at',{ascending:false}),
  authClient.rpc('user_list_redemptions')
 ]);
 const err=[ledgerResult,taskResult,rewardResult,submissionResult,redemptionResult].find(x=>x.error);
 if(err){console.error('Account data load failed:',err.error);$('taskList').innerHTML='<p class="muted">Could not load account data. Please refresh and try again.</p>';$('rewardList').innerHTML='<p class="muted">Rewards could not be loaded.</p>';return}
 $('points').textContent=(ledgerResult.data||[]).reduce((sum,row)=>sum+Number(row.amount||0),0).toLocaleString('en-IN');updateCryptoWithdrawalGate();
 submissions=submissionResult.data||[];activeTasks=taskResult.data||[];activeRewards=rewardResult.data||[];userRedemptions=redemptionResult.data||[];
 $('count').textContent=submissions.length;$('rewardCount').textContent=activeRewards.length;$('balanceFoot').textContent='Verified account points · no guaranteed cash value';
 renderTasks();renderRewards();renderMyRedemptions(userRedemptions);await loadAdminReview();
}

function updateCryptoWithdrawalGate(){
 const pointsEl=$('withdrawalPoints'),progress=$('withdrawalProgress'),gate=$('withdrawalGateMessage');
 const form=$('cryptoWithdrawalForm'),network=$('cryptoNetwork'),wallet=$('cryptoWalletAddress'),button=$('cryptoWithdrawButton');
 if(!pointsEl||!form||!network||!wallet||!button||!gate)return;
 const raw=$('points')?.textContent||'0';
 const balance=Number(raw.replace(/,/g,''))||0;
 const signedIn=!!currentUser;
 const eligible=signedIn&&balance>=2500;
 pointsEl.textContent=signedIn?balance.toLocaleString('en-IN')+' pts':'Sign in to check';
 if(progress)progress.style.width=Math.min(100,(balance/2500)*100)+'%';
 network.disabled=!eligible;wallet.disabled=!eligible;button.disabled=!eligible;
 gate.classList.toggle('error',!eligible);
 if(!signedIn)gate.textContent='Sign in to check your points. You need at least 2,500 points.';
 else if(balance<2500)gate.textContent='You need '+(2500-balance).toLocaleString('en-IN')+' more points to unlock this section.';
 else gate.textContent='Eligible: your balance meets the 2,500-point minimum. Payout processing is not live yet.';
}
$('cryptoWithdrawalForm')?.addEventListener('submit',event=>{
 event.preventDefault();
 const msg=$('cryptoWithdrawalMessage');
 if(!currentUser){msg.textContent='Please sign in first.';msg.classList.add('error');return}
 const balance=Number(($('points')?.textContent||'0').replace(/,/g,''))||0;
 if(balance<2500){msg.textContent='You need at least 2,500 points to interact with this form.';msg.classList.add('error');updateCryptoWithdrawalGate();return}
 msg.classList.add('error');
 msg.textContent='Not submitted: crypto payouts are not configured yet. No withdrawal request was created and no funds will be sent.';
});

let selectedTaskForSubmission=null;
function renderTasks(){
 const list=$('taskList');
 if(!activeTasks.length){list.innerHTML='<p class="muted">No live tasks have been published yet. Please check back later.</p>';return}
 list.innerHTML=activeTasks.map((task,i)=>{const latestSubmission=submissions.find(s=>s.task_id===task.id);const submission=submissions.find(s=>s.task_id===task.id&&['pending','approved'].includes(s.status));const icon=['✦','⌕','▣'][i%3];const tint=['purple','blue','green'][i%3];return '<article class="task"><span class="task-icon '+tint+'">'+icon+'</span><div class="task-info"><b>'+escapeHtml(task.title)+'</b><p>'+escapeHtml(task.description||'Read the task instructions before starting.')+'</p><small>'+escapeHtml(task.category||'Task')+(latestSubmission?' · '+escapeHtml(latestSubmission.status):'')+'</small></div><div class="task-action"><b>+'+Number(task.points||0).toLocaleString('en-IN')+'</b>'+(submission?'<button type="button" disabled>'+escapeHtml(submission.status)+'</button>':'<button type="button" data-open-task="'+escapeHtml(task.id)+'">Open</button><button type="button" data-submit-task="'+escapeHtml(task.id)+'">Submit</button>')+'</div></article>'}).join('');
 list.querySelectorAll('[data-open-task]').forEach(button=>button.addEventListener('click',()=>{const task=activeTasks.find(t=>t.id===button.dataset.openTask);if(!task||!task.destination_url){show('Task instructions','Read the task description and follow its instructions.');return}let url;try{url=new URL(task.destination_url);if(url.protocol!=='https:'&&url.protocol!=='http:')throw Error()}catch{show('Link unavailable','This task has an invalid destination link. Please contact the site administrator.');return}window.open(url.href,'_blank','noopener,noreferrer')}));
 list.querySelectorAll('[data-submit-task]').forEach(button=>button.addEventListener('click',()=>{if(!currentUser){openAuth();setAuthMessage('Please sign in before submitting a task.');return}const task=activeTasks.find(t=>t.id===button.dataset.submitTask);if(!task)return;selectedTaskForSubmission=task;$('submitTaskTitle').textContent=task.title;$('submitTaskDescription').textContent=task.description||'Describe what you completed so the administrator can review it.';$('proofUrl').value='';$('taskNotes').value='';$('submitTaskMessage').textContent='';if($('submitTaskDialog').showModal)$('submitTaskDialog').showModal();else show('Task submission','Open this site in a modern browser to submit tasks.')}));
}
$('submitTaskClose').addEventListener('click',()=>$('submitTaskDialog').close());
$('submitTaskForm').addEventListener('submit',async event=>{event.preventDefault();if(!authClient||!currentUser||!selectedTaskForSubmission){$('submitTaskMessage').textContent='Please sign in and select a task first.';return}const button=$('submitTaskButton');button.disabled=true;button.textContent='Submitting…';$('submitTaskMessage').textContent='';try{const proof=$('proofUrl').value.trim();if(proof){const parsed=new URL(proof);if(!['https:','http:'].includes(parsed.protocol))throw new Error('Please enter a valid http or https proof link.')}const notes=$('taskNotes').value.trim();if(!notes)throw new Error('Please describe what you completed.');const {error}=await authClient.from('task_submissions').insert({user_id:currentUser.id,task_id:selectedTaskForSubmission.id,proof_url:proof||null,notes,status:'pending'});if(error)throw error;$('submitTaskMessage').textContent='Submitted for review. Points are not added until the submission is approved.';await loadAccountData();setTimeout(()=>{if($('submitTaskDialog').open)$('submitTaskDialog').close()},900)}catch(error){$('submitTaskMessage').textContent=error.message||'Could not submit. Please try again.';$('submitTaskMessage').classList.add('error')}finally{button.disabled=false;button.textContent='Send for review'}});
function renderRewards(){
 const list=$('rewardList');
 if(!activeRewards.length){list.innerHTML='<p class="muted">No rewards are currently available. Check back later.</p>';return}
 list.innerHTML=activeRewards.map(reward=>'<article><span>◇</span><b>'+escapeHtml(reward.title)+'</b><p>'+escapeHtml(reward.description||'')+'</p><p class="reward-cost">'+Number(reward.points_cost).toLocaleString('en-IN')+' points · '+escapeHtml(({digital_item:'Digital item · manual fulfilment',gift_card:'Gift card · manual fulfilment',demo:'Demo reward · manual fulfilment',other:'Other · manual fulfilment'})[reward.reward_type]||'Manual fulfilment')+'</p><button type="button" class="redeem-btn" data-redeem="'+escapeHtml(reward.id)+'" '+(userRedemptions.some(row=>row.reward_id===reward.id&&row.status==='pending')?'disabled':'')+'>'+(userRedemptions.some(row=>row.reward_id===reward.id&&row.status==='pending')?'Pending review':currentUser?'Request reward':'Sign in to request')+'</button></article>').join('');
 list.querySelectorAll('[data-redeem]').forEach(button=>button.addEventListener('click',async()=>{
  if(!currentUser){openAuth();setAuthMessage('Sign in to request a reward.');return}
  const reward=activeRewards.find(r=>r.id===button.dataset.redeem);if(!reward)return;
  if(!window.confirm('Request "'+reward.title+'" for '+Number(reward.points_cost).toLocaleString('en-IN')+' points? Points will be deducted now and refunded if your request is rejected. Fulfilment is manual; this is not a cash payout.'))return;
  button.disabled=true;const msg=$('rewardMessage');msg.classList.remove('error');msg.textContent='Sending request…';
  try{const {data,error}=await authClient.rpc('request_reward_redemption',{p_reward_id:reward.id});if(error)throw error;msg.textContent='Request submitted. '+Number(data?.points_deducted||reward.points_cost).toLocaleString('en-IN')+' points deducted. Check your redemption history for status.';await loadAccountData()}
  catch(error){msg.textContent=error.message||'Could not request this reward.';msg.classList.add('error');button.disabled=false}
 }));
}
function renderMyRedemptions(rows){
 const list=$('myRedemptions');if(!list)return;
 if(!currentUser){list.innerHTML='<p class="muted">Sign in to view your requests.</p>';return}
 if(!rows.length){list.innerHTML='<p class="muted">No redemption requests yet.</p>';return}
 const labels={pending:'Pending review',approved:'Approved · awaiting fulfilment',fulfilled:'Fulfilled',rejected:'Rejected · points refunded'};
 list.innerHTML=rows.map(row=>{return '<article class="redemption-history"><b>'+escapeHtml(row.reward_title||'Reward request')+'</b><span>'+Number(row.points_cost).toLocaleString('en-IN')+' pts · '+escapeHtml(labels[row.status]||row.status)+'</span><small>'+escapeHtml(new Date(row.created_at).toLocaleDateString())+'</small></article>'}).join('');
}
$('profile').addEventListener('click',openAuth);
$('authClose').addEventListener('click',()=>authDialog.close());
$('authSwitch').addEventListener('click',()=>{authMode=authMode==='signin'?'signup':'signin';setAuthMessage('');renderAuth()});
$('resendVerification').addEventListener('click',async()=>{const email=$('authEmail').value.trim();if(!authClient||!email.includes('@')){setAuthMessage('Enter the email address you used to create the account first.',true);return}const button=$('resendVerification');button.disabled=true;button.textContent='Sending…';try{const token=requireCaptchaToken();const {error}=await authClient.auth.resend({type:'signup',email,options:{captchaToken:token,emailRedirectTo:window.location.origin+window.location.pathname}});if(error)throw error;setAuthMessage('If this email has an unverified account, a new verification link has been requested. Check your inbox and spam folder.');}catch(error){const message=String(error?.message||'');setAuthMessage(/captcha|turnstile/i.test(message)?'Complete the security check above, then try again.':'Could not request a verification email. Wait a moment and try again.',true)}finally{resetCaptcha();button.disabled=false;button.textContent='Resend verification email';ensureTurnstile()}});
$('authForm').addEventListener('submit',async event=>{event.preventDefault();if($('resendVerification'))$('resendVerification').hidden=true;if(!authClient){setAuthMessage('Authentication is not connected. Check the setup guide.',true);return}const email=$('authEmail').value.trim();const password=$('authPassword').value;const submit=$('authSubmit');submit.disabled=true;submit.textContent=authMode==='signup'?'Creating…':'Signing in…';setAuthMessage('');try{if(authMode==='signup'){const username=$('authUsername').value.trim();if(!/^[A-Za-z0-9_.-]{2,24}$/.test(username))throw new Error('Username must be 2–24 characters: letters, numbers, dots, underscores or hyphens.');if(email.startsWith('@')||email.endsWith('@')||!email.includes('@')||!email.slice(email.indexOf('@')+1).includes('.'))throw new Error('Enter a valid email address.');let referralCode=$('authReferralCode').value.trim().toUpperCase();if(referralCode&&!/^[A-F0-9]{10}$/.test(referralCode))throw new Error('Referral codes must be 10 letters or numbers (A–F and 0–9).');if(!referralCode){referralCode=new URLSearchParams(window.location.search).get('ref')||'';}if(referralCode&&!/^[A-F0-9]{10}$/i.test(referralCode))throw new Error('That referral code is invalid. Check it and try again.');if(referralCode){referralCode=referralCode.toUpperCase();try{sessionStorage.setItem('indiumvault_referral_code',referralCode)}catch{}}else{try{referralCode=sessionStorage.getItem('indiumvault_referral_code')||''}catch{referralCode=''}}if(referralCode&&!/^[A-F0-9]{10}$/.test(referralCode))referralCode='';const token=requireCaptchaToken();const {data,error}=await authClient.auth.signUp({email,password,options:{captchaToken:token,data:{username,...(referralCode&&/^[A-F0-9]{10}$/i.test(referralCode)?{referral_code:referralCode.toUpperCase()}:{})},emailRedirectTo:window.location.origin+window.location.pathname}});if(error)throw error;resetCaptcha();if(data.session){currentUser=data.user;renderAuth();setAuthMessage('Account created and signed in.');await loadAccountData();authDialog.close()}else{setAuthMessage('Account created, but email verification is required. Check your inbox and spam folder. If the email never arrived, use the button below to request another.');if($('resendVerification'))$('resendVerification').hidden=false;}}else if(email.includes('@')){const token=requireCaptchaToken();const {data,error}=await authClient.auth.signInWithPassword({email,password,options:{captchaToken:token}});if(error)throw error;resetCaptcha();currentUser=data.user;renderAuth();setAuthMessage('Signed in successfully.');await loadAccountData();authDialog.close()}else{const token=requireCaptchaToken();const {data,error}=await authClient.functions.invoke('username-sign-in',{body:{identifier:email,password,captchaToken:token}});if(error)throw new Error(data?.error||'Invalid username/email or password.');if(!data?.session)throw new Error('Sign-in did not return a session.');const {data:sessionData,error:sessionError}=await authClient.auth.setSession(data.session);if(sessionError)throw sessionError;resetCaptcha();currentUser=sessionData.user;renderAuth();setAuthMessage('Signed in successfully.');await loadAccountData();authDialog.close()}}catch(error){const message=String(error?.message||'');let friendly='Could not complete authentication. Please check your details and try again.';if(/invalid login credentials|invalid username\/email or password/i.test(message))friendly='Invalid username/email or password.';else if(/email not confirmed|email_not_confirmed/i.test(message)){friendly='Your email is not verified yet. Check your inbox and spam folder, then use the button below to resend the verification email if needed.';$('resendVerification').hidden=false;}else if(/already registered|user already exists/i.test(message)){friendly='This email already has an account. Switch to Sign in and use your existing password. If the email is not verified, the resend button will appear.';$('resendVerification').hidden=false;}else if(/captcha|turnstile|security check/i.test(message))friendly='Security verification failed. Please complete the check again.';setAuthMessage(friendly,true)}finally{resetCaptcha();submit.disabled=false;renderAuth()}});
$('authSignout').addEventListener('click',async()=>{if(!authClient)return;const {error}=await authClient.auth.signOut();if(error){setAuthMessage(error.message,true);return}currentUser=null;authMode='signin';setAuthMessage('You have signed out.');renderAuth();await loadAccountData()});
$('moreNav')?.addEventListener('click',()=>{const menu=$('moreDialog');if(menu&&menu.showModal)menu.showModal();else if(menu)menu.setAttribute('open','')});
$('moreClose')?.addEventListener('click',()=> $('moreDialog')?.close());
$('moreAccount')?.addEventListener('click',()=>{ $('moreDialog')?.close(); openAuth(); });
$('moreHelp')?.addEventListener('click',()=>{ $('moreDialog')?.close(); show('Help & safety','IndiumVault Earn points are not guaranteed cash. Offers are still being prepared, reward requests are reviewed manually, and cash withdrawals are not enabled. Never pay a fee to unlock an offer or reward.'); });
$('activity').addEventListener('click',()=>{if(!currentUser){show('Account activity','Sign in to view your verified points and task submissions.');return}show('Account activity','Submissions recorded: '+submissions.length+'. Points balance: '+$('points').textContent+'. Points are added only after an approved review.')});
async function getReferralDetails(){if(!authClient||!currentUser)throw new Error('Sign in to access your referral link.');const {data,error}=await authClient.from('account_profiles').select('referral_code').eq('user_id',currentUser.id).maybeSingle();if(error)throw error;if(!data?.referral_code)throw new Error('Your referral link is not available yet. Please refresh your profile.');const url=new URL(window.location.origin+window.location.pathname);url.searchParams.set('ref',data.referral_code);return {url:url.toString(),code:data.referral_code};}
async function refreshHomeReferralCount(){if(!authClient||!currentUser)return;const countEl=$('homeReferralCount');if(!countEl)return;countEl.textContent='…';try{const {data,error}=await authClient.rpc('my_referral_count');if(error)throw error;countEl.textContent=Number(data||0).toLocaleString('en-IN')}catch(error){console.warn('Home referral count unavailable',error);countEl.textContent='Unavailable'}}
$('copy').addEventListener('click',async()=>{if(!currentUser){openAuth();setAuthMessage('Sign in to copy your referral link.');return}const button=$('copy');button.disabled=true;try{const details=await getReferralDetails();$('profileReferralCode').value=details.code;$('profileReferralLink').value=details.url;await navigator.clipboard.writeText(details.url);$('copyMessage').textContent='Referral link copied. New signups through it can be recorded; referral bonuses are not enabled.'}catch(error){if(error.name==='NotAllowedError'||error.name==='SecurityError'){$('copyMessage').textContent='Clipboard access unavailable. Open your profile and select the referral link to copy it.'}else{$('copyMessage').textContent=error.message||'Could not load your referral link.'} }finally{button.disabled=false}});
if($('shareReferral'))$('shareReferral').addEventListener('click',async()=>{if(!currentUser){openAuth();setAuthMessage('Sign in to share your referral link.');return}const button=$('shareReferral');button.disabled=true;try{const details=await getReferralDetails();$('profileReferralCode').value=details.code;$('profileReferralLink').value=details.url;if(navigator.share){await navigator.share({title:'Join IndiumVault Earn',text:'Join me on IndiumVault Earn.',url:details.url});$('copyMessage').textContent='Share sheet opened.'}else{await navigator.clipboard.writeText(details.url);$('copyMessage').textContent='Sharing is unavailable here, so your referral link was copied.'}}catch(error){if(error.name!=='AbortError')$('copyMessage').textContent=error.message||'Could not share the referral link.'}finally{button.disabled=false}});

$('close').addEventListener('click',()=>$('dialog').close());$('okay').addEventListener('click',()=>$('dialog').close());
if(isConfigured&&window.supabase){try{const sharedStorage={getItem(key){try{return window.localStorage.getItem(key)}catch(e){console.warn('Local session read failed; trying session storage',e);try{return window.sessionStorage.getItem(key)}catch{return null}}},setItem(key,value){try{window.localStorage.setItem(key,value)}catch(e){console.warn('Local session write failed; trying session storage',e);try{window.sessionStorage.setItem(key,value)}catch(storageError){console.error('Session storage unavailable',storageError);throw storageError}}},removeItem(key){try{window.localStorage.removeItem(key)}catch{}try{window.sessionStorage.removeItem(key)}catch{}}};authClient=window.supabase.createClient(authConfig.url,authConfig.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:sharedStorage,storageKey:'indiumvault-earn-auth-v1'}});authClient.auth.onAuthStateChange((_event,session)=>{currentUser=session?.user||null;renderAuth();queueMicrotask(()=>loadAccountData())});authClient.auth.getSession().then(async({data,error})=>{if(error){console.error('Session restore failed:',error);setAuthMessage('Could not restore your sign-in session. Please refresh the page.',true);return}currentUser=data.session?.user||null;renderAuth();await loadAccountData()}).catch(error=>{console.error('Session initialization failed:',error);setAuthMessage('Could not restore your sign-in session. Please refresh the page.',true)})}catch(error){console.error('Supabase initialization failed:',error);authClient=null}}
renderAuth();

// Re-check the persisted Supabase session when a page is restored or revisited.
// This keeps the header and account data in sync across Home, Tasks, and Withdraw.
let sessionSyncInProgress=false;
async function syncPersistedSession(){
 if(!authClient||sessionSyncInProgress)return;
 sessionSyncInProgress=true;
 try{
  const {data,error}=await authClient.auth.getSession();
  if(error){console.warn('Session resync failed:',error);return}
  const nextUser=data.session?.user||null;
  const previousId=currentUser?.id||null;
  currentUser=nextUser;
  renderAuth();
  if((nextUser?.id||null)!==previousId||nextUser)await loadAccountData();
 }catch(error){console.warn('Could not resync the signed-in account:',error)}
 finally{sessionSyncInProgress=false}
}
window.addEventListener('pageshow',()=>{syncPersistedSession()});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')syncPersistedSession()});

function adminMessage(message,isError=false){const el=$('adminMessage');if(!el)return;el.textContent=message;el.classList.toggle('error',isError)}






async function loadAdminReview(){
 const panel=$('adminPanel');
 if(!panel)return;
 // Keep private controls hidden unless the database confirms administrator access.
 panel.hidden=true;
 if(!authClient||!currentUser)return;
 try{
  const {error}=await authClient.rpc('admin_list_tasks');
  if(error)return;
  panel.hidden=false;
  if(typeof refreshAdminConsole==='function')await refreshAdminConsole();
 }catch(error){
  panel.hidden=true;
  console.warn('Admin controls unavailable for this account.');
 }
}


$('adminUidLookupForm').addEventListener('submit',async event=>{event.preventDefault();if(!authClient||!currentUser)return;const uid=$('adminUidLookup').value.trim();const output=$('adminUidLookupResult');output.innerHTML='<p class="muted">Searching…</p>';try{const {data,error}=await authClient.rpc('admin_lookup_account_by_uid',{p_support_uid:uid});if(error)throw error;const row=Array.isArray(data)?data[0]:data;if(!row){output.innerHTML='<p class="muted">No account found for that UID.</p>';return}output.innerHTML='<article class="admin-list-item"><div><b>'+escapeHtml(row.username?'@'+row.username:'No username')+'</b><p>UID: '+escapeHtml(row.support_uid)+'<br>Email: '+escapeHtml(row.email||'Unavailable')+'<br>Points wallet: '+Number(row.points_balance||0).toLocaleString('en-IN')+' pts<br>Created: '+escapeHtml(new Date(row.created_at).toLocaleDateString())+'</p></div></article>'}catch(e){output.innerHTML='<p class="muted">'+escapeHtml(e.message||'Lookup failed. Admin access is required.')+'</p>'}});






function adminCard(title,details,actions=''){return '<article class="admin-list-item"><div><b>'+escapeHtml(title)+'</b><p>'+details+'</p></div>'+actions+'</article>'}
async function refreshAdminConsole(){
 if(!authClient||!currentUser)return;
 const ids=['adminSubmissionList','adminRedemptionList','adminTaskList','adminRewardList'];
 ids.forEach(id=>{const el=$(id);if(el)el.innerHTML='<p class="muted">Loading…</p>'});
 const specs=[
  ['admin_list_pending_submissions',{},'adminSubmissionList'],
  ['admin_list_redemptions',{},'adminRedemptionList'],
  ['admin_list_tasks',{},'adminTaskList'],
  ['admin_list_rewards',{},'adminRewardList']
 ];
 const results=await Promise.all(specs.map(async([fn,args,id])=>({fn,id,...await authClient.rpc(fn,args)})));
 for(const result of results){
  const target=$(result.id);if(!target)continue;
  if(result.error){target.innerHTML='<p class="muted">'+escapeHtml(result.error.message||'Administrator access required.')+'</p>';continue}
  const rows=result.data||[];
  if(result.id==='adminSubmissionList'){
   target.innerHTML=rows.length?rows.map(row=>adminCard(row.task_title||'Task submission','UID account · '+escapeHtml(row.user_email||'email unavailable')+'<br>Points: '+Number(row.task_points||0)+'<br>'+escapeHtml(row.notes||'No notes')+(safeHttpUrl(row.proof_url)?'<br><a class="proof-link" href="'+escapeHtml(safeHttpUrl(row.proof_url))+'" target="_blank" rel="noopener noreferrer">Open proof link</a>':(row.proof_url?'<br><span>Invalid proof link hidden</span>':''))+'<br>'+escapeHtml(new Date(row.submitted_at).toLocaleString()),'<div class="admin-list-actions"><button type="button" data-submission="'+escapeHtml(row.submission_id)+'" data-decision="approved">Approve</button><button type="button" data-submission="'+escapeHtml(row.submission_id)+'" data-decision="rejected">Reject</button></div>')).join(''):'<p class="muted">No pending submissions.</p>';
  }else if(result.id==='adminRedemptionList'){
   const pending=rows.filter(row=>row.status==='pending'||row.status==='approved');
   target.innerHTML=pending.length?pending.map(row=>adminCard(row.reward_title||'Reward request',escapeHtml(row.user_email||'email unavailable')+'<br>Cost: '+Number(row.points_cost||0)+' pts<br>Status: '+escapeHtml(row.status)+'<br>Requested: '+escapeHtml(new Date(row.created_at).toLocaleString()),'<div class="admin-list-actions">'+(row.status==='pending'?'<button type="button" data-redemption="'+escapeHtml(row.redemption_id)+'" data-decision="approved">Approve</button><button type="button" data-redemption="'+escapeHtml(row.redemption_id)+'" data-decision="rejected">Reject + refund</button>':'<button type="button" data-redemption="'+escapeHtml(row.redemption_id)+'" data-decision="fulfilled">Mark fulfilled</button>')+'</div>')).join(''):'<p class="muted">No pending or approved reward requests.</p>';
  }else if(result.id==='adminTaskList'){
   target.innerHTML=rows.length?rows.map(row=>adminCard(row.title,Number(row.points)+' pts · '+(row.is_active?'Published':'Hidden')+'<br>'+escapeHtml(row.category||'general'),'<div class="admin-list-actions"><button type="button" data-edit-task="'+escapeHtml(row.task_id)+'">Edit</button></div>')).join(''):'<p class="muted">No tasks created yet.</p>';
  }else{
   target.innerHTML=rows.length?rows.map(row=>adminCard(row.title,Number(row.points_cost)+' pts · '+escapeHtml(row.reward_type)+' · '+(row.is_active?'Visible':'Hidden')+'<br>'+escapeHtml(row.description||''),'<div class="admin-list-actions"><button type="button" data-edit-reward="'+escapeHtml(row.reward_id)+'">Edit</button></div>')).join(''):'<p class="muted">No rewards created yet.</p>';
  }
 }
 document.querySelectorAll('[data-submission]').forEach(button=>button.addEventListener('click',async()=>{button.disabled=true;try{const {error}=await authClient.rpc('admin_review_submission',{p_submission_id:button.dataset.submission,p_decision:button.dataset.decision});if(error)throw error;adminMessage('Submission '+button.dataset.decision+'.');await loadAccountData();await refreshAdminConsole()}catch(e){adminMessage(e.message||'Could not review submission.',true);button.disabled=false}}));
 document.querySelectorAll('[data-redemption]').forEach(button=>button.addEventListener('click',async()=>{if(button.dataset.decision==='rejected'&&!confirm('Reject this request and refund its points?'))return;button.disabled=true;try{const {error}=await authClient.rpc('admin_review_redemption',{p_redemption_id:button.dataset.redemption,p_decision:button.dataset.decision});if(error)throw error;adminMessage(button.dataset.decision==='rejected'?'Request rejected; refund processed if applicable.':'Reward request approved.');await loadAccountData();await refreshAdminConsole()}catch(e){adminMessage(e.message||'Could not review reward request.',true);button.disabled=false}}));
 document.querySelectorAll('[data-edit-task]').forEach(button=>button.addEventListener('click',async()=>{const {data,error}=await authClient.rpc('admin_list_tasks');if(error){adminMessage(error.message,true);return}const row=(data||[]).find(item=>item.task_id===button.dataset.editTask);if(!row)return;$('adminTaskId').value=row.task_id;$('adminTaskTitle').value=row.title;$('adminTaskDescription').value=row.description||'';$('adminTaskCategory').value=row.category||'general';$('adminTaskPoints').value=row.points;$('adminTaskUrl').value=row.destination_url||'';$('adminTaskActive').checked=!!row.is_active;$('adminTaskTitle').scrollIntoView({behavior:'smooth',block:'center'})}));
 document.querySelectorAll('[data-edit-reward]').forEach(button=>button.addEventListener('click',async()=>{const {data,error}=await authClient.rpc('admin_list_rewards');if(error){adminMessage(error.message,true);return}const row=(data||[]).find(item=>item.reward_id===button.dataset.editReward);if(!row)return;$('adminRewardId').value=row.reward_id;$('adminRewardTitle').value=row.title;$('adminRewardDescription').value=row.description||'';$('adminRewardCost').value=row.points_cost;$('adminRewardType').value=row.reward_type;$('adminRewardActive').checked=!!row.is_active;$('adminRewardTitle').scrollIntoView({behavior:'smooth',block:'center'})}));
}
$('adminRefresh')?.addEventListener('click',()=>refreshAdminConsole().catch(e=>adminMessage(e.message||'Refresh failed.',true)));
$('adminTaskReset')?.addEventListener('click',()=>{$('adminTaskForm').reset();$('adminTaskId').value='';$('adminTaskCategory').value='general';$('adminTaskPoints').value='10';$('adminTaskActive').checked=true});
$('adminRewardReset')?.addEventListener('click',()=>{$('adminRewardForm').reset();$('adminRewardId').value='';$('adminRewardCost').value='50';$('adminRewardActive').checked=true});
$('adminTaskForm')?.addEventListener('submit',async event=>{event.preventDefault();if(!authClient||!currentUser)return;const url=$('adminTaskUrl').value.trim();if(url){try{const parsed=new URL(url);if(!['https:','http:'].includes(parsed.protocol))throw Error();}catch{$('adminMessage').textContent='Enter a valid http or https destination URL.';$('adminMessage').classList.add('error');return}}const button=$('adminTaskForm').querySelector('[type=submit]');button.disabled=true;try{const {error}=await authClient.rpc('admin_save_task',{p_task_id:$('adminTaskId').value||null,p_title:$('adminTaskTitle').value.trim(),p_description:$('adminTaskDescription').value.trim(),p_category:$('adminTaskCategory').value.trim()||'general',p_points:Number($('adminTaskPoints').value),p_destination_url:url||null,p_is_active:$('adminTaskActive').checked});if(error)throw error;adminMessage('Task saved.');$('adminTaskReset').click();await refreshAdminConsole();await loadAccountData()}catch(e){adminMessage(e.message||'Could not save task.',true)}finally{button.disabled=false}});
$('adminRewardForm')?.addEventListener('submit',async event=>{event.preventDefault();if(!authClient||!currentUser)return;const button=$('adminRewardForm').querySelector('[type=submit]');button.disabled=true;try{const {error}=await authClient.rpc('admin_save_reward',{p_reward_id:$('adminRewardId').value||null,p_title:$('adminRewardTitle').value.trim(),p_description:$('adminRewardDescription').value.trim(),p_points_cost:Number($('adminRewardCost').value),p_reward_type:$('adminRewardType').value,p_is_active:$('adminRewardActive').checked});if(error)throw error;adminMessage('Reward saved. Requests are manually fulfilled; this does not enable payouts.');$('adminRewardReset').click();await refreshAdminConsole();await loadAccountData()}catch(e){adminMessage(e.message||'Could not save reward.',true)}finally{button.disabled=false}});


/* Separate page views for the GitHub Pages site */
(function setupPageRoutes(){
 const path=window.location.pathname.toLowerCase();
 const page=path.endsWith('/tasks.html')?'tasks':path.endsWith('/rewards.html')?'rewards':path.endsWith('/withdrawal.html')?'withdrawal':'home';
 const main=document.querySelector('main');
 if(!main)return;
 document.body.classList.add(page+'-page');
 document.body.classList.toggle('tasks-page',page==='tasks');
 const visibleByPage={
  home:['intro','balance','stats','adminPanel','offers','referral','notice'],
  tasks:['intro','balance','adminPanel','offers','tasks','notice'],
  rewards:['intro','balance','adminPanel','rewards','notice'],
  withdrawal:['intro','balance','adminPanel','withdrawal','notice']
 };
 const allowed=new Set(visibleByPage[page]);
 [...main.children].forEach(el=>{
  const id=el.id||'';
  el.classList.toggle('page-route-hidden',!allowed.has(id));
  if(id==='tasks'||id==='rewards')el.hidden=page!==id;
 });
 document.querySelectorAll('[data-page-link]').forEach(link=>{
  const active=link.dataset.pageLink===page;
  link.classList.toggle('nav-active',active);
  if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
 });
 const titles={home:['YOUR EARNING HUB','Earn points.','Complete tasks.','Browse partner offers, complete available tasks, and track your points.'],tasks:['COMPLETE TASKS','Tasks','Earn points.','Browse partner offers and surveys, then check platform tasks and your submission status below.'],rewards:['YOUR CATALOGUE','Rewards','Redeem carefully.','Review reward terms before making a request.'],withdrawal:['POINTS WALLET','Withdrawals','Clear terms.','See the current status of cash withdrawals.']};
 const t=titles[page],intro=document.querySelector('.intro');
 if(intro&&page!=='home'){
  const eyebrow=intro.querySelector('.eyebrow'),heading=intro.querySelector('h1'),desc=intro.querySelector('.muted');
  if(eyebrow)eyebrow.textContent=t[0];
  if(heading)heading.innerHTML=t[1]+'<br><span>'+t[2]+'</span>';
  if(desc)desc.textContent=t[3];
 }
})();
