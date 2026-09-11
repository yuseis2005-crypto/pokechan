/* Stable browser storage. Site releases never change these keys or seed user data. */
(function(root){
  function createPokeStore({storage,legacy,onStatus=()=>{}}){
    const issues=new Map();
    const backupKey=k=>"pc:backup:"+k.slice(3);
    const valid=(k,v)=>{
      if(typeof v!=="string")return false;
      if(k==="pc:build")return v.length>0;
      try{const a=JSON.parse(v);if(!Array.isArray(a))return false;
        if(k==="pc:trial")return a.every(x=>x&&typeof x.n==="string");
        if(k==="pc:foes")return a.every(x=>Array.isArray(x)&&x.every(n=>typeof n==="string"));
        return a.every(n=>typeof n==="string");
      }catch{return false;}
    };
    function report(k,message){if(message)issues.set(k,message);else issues.delete(k);onStatus([...issues.values()]);}
    function read(k){try{return{value:storage().getItem(k),ok:true};}catch{return{value:null,ok:false};}}
    function write(k,v){try{storage().setItem(k,v);return true;}catch{return false;}}
    function set(k,v){
      if(!valid(k,v)){report(k,"保存データの形式が不正です。書き出して内容を確認してください。");return false;}
      const old=read(k);let backed=true;
      if(old.value!==v&&valid(k,old.value))backed=write(backupKey(k),old.value);
      const ok=write(k,v);
      report(k,!ok?"端末への保存に失敗しました。ページを閉じる前にバックアップを保存してください。":!backed?"現在の内容は保存済みですが、直前のバックアップを保存できませんでした。":null);
      return ok;
    }
    async function get(k){
      const current=read(k);
      if(valid(k,current.value))return current.value;
      const previous=read(backupKey(k));
      if(valid(k,previous.value)){
        const ok=write(k,previous.value);
        report(k,ok?"保存データを直前のバックアップから復元しました。手持ちを確認してください。":"バックアップを読み込みましたが端末に保存できません。ファイルに書き出してください。");
        return previous.value;
      }
      // Only migrate the older app store when local data is missing; never let it override a local save.
      if(current.ok&&current.value===null){
        try{const provider=legacy();
          if(provider&&typeof provider.get==="function"){
            const result=await Promise.race([provider.get(k),new Promise((_,reject)=>setTimeout(()=>reject(Error("timeout")),1500))]);
            if(result&&valid(k,result.value)){
              // Another tab may have saved while the legacy read was pending.
              const latest=read(k);if(valid(k,latest.value))return latest.value;
              set(k,result.value);return result.value;
            }
          }
        }catch{report(k,"旧アプリの保存先を読み込めませんでした。以前の版で書き出したデータから復元できます。");}
      }
      if(!current.ok)report(k,"保存先にアクセスできません。手持ちが空でも元データを上書きしていません。");
      else if(current.value!==null)report(k,"保存データを読み込めません。元データは残しています。バックアップを読み込んでください。");
      return null;
    }
    function previous(k){const v=read(backupKey(k)).value;return valid(k,v)?v:null;}
    return{get,set,previous,valid,current:k=>{const v=read(k).value;return valid(k,v)?v:null;},issues:()=>[...issues.values()]};
  }
  if(typeof module!=="undefined"&&module.exports)module.exports={createPokeStore};
  else root.createPokeStore=createPokeStore;
})(typeof globalThis!=="undefined"?globalThis:this);
