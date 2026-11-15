(function(root){
  'use strict';
  const index = new Map(root.EXAMS.map(e=>[e.id,e]));
  const point = i => i < 20 ? 1 : 2;
  const key = (eid,i) => `${eid}:${i}`;
  function score(items){
    let earned=0,total=0,correct=0,answered=0;
    const results=items.map(it=>{
      const e=index.get(it.examId);const valid=e&&Number.isInteger(it.index)&&it.index>=0&&it.index<e.answers.length;
      if(!e||!valid)throw new Error('不明な問題です');
      const answer=it.answer??null;const autoCredit=(e.autoCredit||[]).includes(it.index);const right=autoCredit||answer===e.answers[it.index];const points=point(it.index);
      total+=points;if(answer!==null)answered++;if(right){earned+=points;correct++;}
      return {...it,answer,correct:right,points,expected:e.answers[it.index],autoCredit};
    });
    return {earned,total,correct,answered,count:items.length,results};
  }
  function mistakes(history){
    const map=new Map();
    for(const h of history){for(const r of score(h.items).results){
      const k=key(r.examId,r.index),old=map.get(k);
      map.set(k,{examId:r.examId,index:r.index,lastAnswer:r.answer,pending:!r.correct,wrongCount:(old?.wrongCount||0)+(r.correct?0:1),attempts:(old?.attempts||0)+1,lastAt:h.submittedAt});
    }}
    return Array.from(map.values()).filter(x=>x.pending).sort((a,b)=>b.wrongCount-a.wrongCount||a.lastAt.localeCompare(b.lastAt));
  }
  function validate(data){
    if(!data||data.version!==1||!Array.isArray(data.history)||typeof data.notes!=='object'||!data.notes||Array.isArray(data.notes))throw new Error('対応する学習データではありません');
    if(data.history.length>10000||Object.keys(data.notes).length>10000)throw new Error('データ量が大きすぎます');
    function validateItems(items){
      if(!Array.isArray(items)||!items.length||items.length>4560)throw new Error('解答データが不正です');
      const seen=new Set();
      for(const it of items){
        const e=index.get(it.examId),k=key(it.examId,it.index),max=Math.floor(it.index/5)===7?6:4;
        if(!e||!Number.isInteger(it.index)||it.index<0||it.index>=e.answers.length||seen.has(k)||!(it.answer===null||Number.isInteger(it.answer)&&it.answer>=1&&it.answer<=max))throw new Error('問題番号または選択肢が不正です');
        seen.add(k);
      }
    }
    function validateMode(mode,items){
      if(!['exam','review'].includes(mode))throw new Error('学習種別が不正です');
      if(mode==='exam'&&(items.length!==60||items.some(it=>it.examId!==items[0].examId)||new Set(items.map(i=>i.index)).size!==60))throw new Error('過去問1回分の解答が揃っていません');
    }
    const history=data.history.map(h=>{
      if(typeof h.id!=='string'||h.id.length>120||!['exam','review'].includes(h.mode)||typeof h.submittedAt!=='string'||!Number.isFinite(Date.parse(h.submittedAt)))throw new Error('学習履歴が不正です');
      validateItems(h.items);validateMode(h.mode,h.items);return {id:h.id,mode:h.mode,submittedAt:h.submittedAt,elapsed:Math.max(0,Math.min(864000,Number(h.elapsed)||0)),items:h.items.map(i=>({examId:i.examId,index:i.index,answer:i.answer}))};
    });
    if(new Set(history.map(x=>x.id)).size!==history.length)throw new Error('履歴IDが重複しています');
    history.sort((a,b)=>a.submittedAt.localeCompare(b.submittedAt));
    const notes={};for(const [k,v]of Object.entries(data.notes)){const m=k.match(/^(\d+-[12]):(\d+)$/);if(!m||!index.has(m[1])||+m[2]>=60||typeof v!=='string'||v.length>3000)throw new Error('メモが不正です');notes[k]=v;}
    let draft=null;
    if(data.draft){const d=data.draft;validateItems(d.items);validateMode(d.mode,d.items);draft={mode:d.mode,items:d.items.map(i=>({examId:i.examId,index:i.index,answer:i.answer})),elapsed:Math.max(0,Math.min(864000,Number(d.elapsed)||0))};}
    return {version:1,history,notes,draft};
  }
  root.StudyEngine={index,point,key,score,mistakes,validate};
})(typeof window!=='undefined'?window:globalThis);
