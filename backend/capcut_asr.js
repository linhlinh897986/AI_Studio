const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

const BASE = "https://editor-api-sg.capcutapi.com";
const VOD_REGION = "sdwdmwlll";
const VOD_SERVICE = "vod";

function createRandomDevice() {
  const randomDid = '7' + Math.floor(Math.random() * 1e18).toString().padStart(18, '0');
  const macs = ['MacBookPro17,1', 'MacBookPro18,1', 'MacBookPro18,2', 'MacBookAir10,1', 'Macmini9,1'];
  const model = macs[Math.floor(Math.random() * macs.length)];
  const versions = ['12.7.2', '13.6.1', '14.5.0', '15.7.4'];
  const os = versions[Math.floor(Math.random() * versions.length)];
  return {
    aid: "359289",
    app_name: "CapCut",
    appvr: "8.7.0",
    version_name: "8.7.0",
    version_code: "8.7.0",
    channel: "capcutpc_google",
    device_platform: "mac",
    device_type: model,
    device_brand: model,
    os_version: os,
    device_id: randomDid,
    iid: '7' + Math.floor(Math.random() * 1e18).toString().padStart(18, '0'),
    region: "VN",
    loc: "VN",
    lan: "vi-VN",
    pf: "3",
    tdid: randomDid,
  };
}

const DEFAULT_DEVICE = createRandomDevice();

// ── CRC32 Helper ────────────────────────────────────────────────────────────
const crc32Table = new Int32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crc32Table[i] = c;
}

function crc32(buffer) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buffer.length; i++) {
    crc = (crc >>> 8) ^ crc32Table[(crc ^ buffer[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function crc32_hex(buffer) {
  return crc32(buffer).toString(16).padStart(8, '0');
}

// ── Crypto / Signing Helpers ────────────────────────────────────────────────
function make_x_ss_stub(bodyText) {
  return crypto.createHash('md5').update(bodyText, 'utf8').digest('hex');
}

function make_sign_header(url, appvr, deviceTime, tdid) {
  const urlPath = url.split("?")[0];
  const last7 = urlPath.slice(-7);
  const signStr = `9e2c|${last7}|3|${appvr}|${deviceTime}|${tdid}|11ac`;
  return crypto.createHash('md5').update(signStr, 'utf8').digest('hex');
}

function sha256_hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmac_sha256(key, msg) {
  return crypto.createHmac('sha256', key).update(msg).digest();
}

function aws4_signing_key(secretAccessKey, dateStamp, region = VOD_REGION, service = VOD_SERVICE) {
  const kDate = hmac_sha256("AWS4" + secretAccessKey, dateStamp);
  const kRegion = hmac_sha256(kDate, region);
  const kService = hmac_sha256(kRegion, service);
  return hmac_sha256(kService, "aws4_request");
}

function urlencode(obj) {
  return Object.keys(obj)
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(obj[k])}`)
    .join('&');
}

function canonical_query(urlStr) {
  const u = new URL(urlStr);
  const params = Array.from(u.searchParams.entries());
  params.sort((a, b) => {
    if (a[0] < b[0]) return -1;
    if (a[0] > b[0]) return 1;
    if (a[1] < b[1]) return -1;
    if (a[1] > b[1]) return 1;
    return 0;
  });
  
  const quote = (str) => {
    return encodeURIComponent(str)
      .replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  };
  
  return params.map(([k, v]) => `${quote(k)}=${quote(v)}`).join('&');
}

function aws4_authorization(method, urlStr, body, accessKeyId, secretAccessKey, sessionToken, amzDate) {
  const dateStamp = amzDate.substring(0, 8);
  const scope = `${dateStamp}/${VOD_REGION}/${VOD_SERVICE}/aws4_request`;
  const signedHeaders = "x-amz-date;x-amz-security-token";
  const canonicalHeaders = `x-amz-date:${amzDate}\nx-amz-security-token:${sessionToken}\n`;
  const u = new URL(urlStr);
  const canonicalRequest = [
    method,
    u.pathname,
    canonical_query(urlStr),
    canonicalHeaders,
    signedHeaders,
    sha256_hex(body)
  ].join('\n');
  
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256_hex(canonicalRequest)
  ].join('\n');
  
  const signingKey = aws4_signing_key(secretAccessKey, dateStamp);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');
  return `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

function utc_now_for_vod() {
  const now = new Date();
  
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const min = String(now.getUTCMinutes()).padStart(2, '0');
  const ss = String(now.getUTCSeconds()).padStart(2, '0');
  const amzDate = `${yyyy}${mm}${dd}T${hh}${min}${ss}Z`;
  
  const httpDate = now.toUTCString(); 
  return [amzDate, httpDate];
}

function file_md5(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(buffer).digest('hex');
}

function common_query(device, babiParam = null, includeRegion = true) {
  const q = {
    app_name: device.app_name,
    device_type: device.device_type,
    os_version: device.os_version,
    channel: device.channel,
    version_name: device.version_name,
    device_brand: device.device_brand,
    device_id: device.device_id,
    iid: device.iid,
    version_code: device.version_code,
    device_platform: device.device_platform,
    aid: device.aid,
  };
  if (includeRegion) {
    q.region = device.region;
  }
  if (babiParam !== null) {
    q.babi_param = JSON.stringify(babiParam);
  }
  return q;
}

function base_headers(device, bodyText, appid = false) {
  const now = String(Math.floor(Date.now() / 1000));
  const headers = {
    "content-type": "application/json",
    appvr: device.appvr,
    ch: device.channel,
    "device-time": now,
    lan: device.lan,
    loc: device.loc,
    pf: device.pf,
    "sign-ver": "1",
    tdid: device.tdid,
    "x-ss-stub": make_x_ss_stub(bodyText),
    "x-ss-dp": device.aid,
    "x-khronos": now,
    "x-tt-trace-id": make_trace_id(),
    "user-agent": "Cronet/TTNetVersion:1d7cc3b1 2025-07-16 QuicVersion:52c2b40d 2025-04-03",
    "accept-encoding": "gzip, deflate",
    "store-country-code": device.loc.toLowerCase(),
    "store-country-code-src": "did",
    "is-dispatch-us-ttp": "0",
    "is-app-region-us-ttp": "0",
  };
  if (appid) {
    headers["app-sdk-version"] = device.appvr;
    headers.appid = device.aid;
  }
  return headers;
}

function make_trace_id() {
  const seed = crypto.randomUUID().replace(/-/g, '');
  return `00-${seed}-${seed.substring(0, 16)}-01`;
}

function stt_new_body(audioVid, audioMd5, durationMs, language, translationLanguage, useTranslation) {
  const babi = {
    feature_entrance: "editor",
    feature_entrance_detail: "editor-elements-captions-subtitle_recognition",
    feature_key: "subtitle_recognition",
    scenario: "video_editor",
  };
  const capJson = {
    adjust_endtime: 200,
    audio: audioVid,
    audio_type: "vid",
    caption_type: 0,
    client_request_id: crypto.randomUUID(),
    duration: Math.floor(durationMs),
    enable_cache: true,
    enter_from: "asr",
    language: language,
    max_lines: 1,
    md5: audioMd5,
    pack_options: { need_attribute: true },
    songs_info: [{ end_time: parseFloat(durationMs) - 10.334, id: "", start_time: 0 }],
    translation_language: translationLanguage,
    use_translation: !!useTranslation,
    words_per_line: 15,
  };
  const body = {
    bind_id: crypto.randomUUID().toUpperCase(),
    can_queue: true,
    enter_from: "asr",
    tasks: [
      {
        context: crypto.randomUUID(),
        payload: JSON.stringify({ cap_json: capJson }),
        req_key: "cc_audio_subtitle_asr",
        task_version: "v3",
      }
    ],
  };
  return { babi, body };
}

function query_body(taskId, token, reqKey, bindId = "") {
  return {
    tasks: [
      {
        bind_id: bindId,
        id: taskId,
        req_key: reqKey,
        task_version: "v3",
        token: token,
      }
    ]
  };
}

function upload_sign_request(device) {
  const body = { biz: "cc_pc_text_recognize", key_version: "v5" };
  const bodyText = JSON.stringify(body);
  const path = "/lv/v1/upload_sign";
  const query = common_query(device, null, false);
  const url = BASE + path + "?" + urlencode(query);
  const headers = base_headers(device, bodyText, true);
  
  const lowerHeaders = {};
  for (const k of Object.keys(headers)) {
    lowerHeaders[k.toLowerCase()] = headers[k];
  }
  
  if (!lowerHeaders["sign"]) {
    headers["sign"] = make_sign_header(url, device.appvr, lowerHeaders["device-time"], device.tdid);
  }
  return { url, headers, bodyText };
}

function vod_signed_headers(method, urlStr, body, creds, device) {
  const [amzDate, httpDate] = utc_now_for_vod();
  const bodyBytes = typeof body === 'string' ? Buffer.from(body, 'utf8') : body;
  
  return {
    "Authorization": aws4_authorization(
      method, urlStr, bodyBytes, creds.access_key_id, creds.secret_access_key, creds.session_token, amzDate
    ),
    "Date": httpDate,
    "User-Agent": `BDFileUpload(${Math.floor(Date.now())})`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": "31536000",
    "X-Amz-Security-Token": creds.session_token,
    "accept-encoding": "identity",
    "store-country-code": device.loc.toLowerCase(),
    "store-country-code-src": "did",
    "is-dispatch-us-ttp": "0",
    "is-app-region-us-ttp": "0",
    "tdid": device.tdid,
    "pf": device.pf,
  };
}

function upload_binary_headers(auth, crc32, device) {
  return {
    "Authorization": auth,
    "Date": utc_now_for_vod()[1],
    "User-Agent": `BDFileUpload(${Math.floor(Date.now())})`,
    "X-Upload-Content-CRC32": crc32,
    "accept-encoding": "identity",
    "store-country-code": device.loc.toLowerCase(),
    "store-country-code-src": "did",
    "is-dispatch-us-ttp": "0",
    "is-app-region-us-ttp": "0",
    "tdid": device.tdid,
    "pf": device.pf,
  };
}

function upload_finish_headers(auth, device) {
  const headers = upload_binary_headers(auth, "", device);
  delete headers["X-Upload-Content-CRC32"];
  return headers;
}

// ── Upload Audio File ────────────────────────────────────────────────────────
async function upload_audio_file(filePath, device) {
  const localMd5 = file_md5(filePath);
  const data = fs.readFileSync(filePath);
  const partCrc32 = crc32_hex(data);

  const { url, headers, bodyText } = upload_sign_request(device);
  const signResp = await axios.post(url, bodyText, { headers, timeout: 60000 });
  const signData = signResp.data;
  
  const creds = signData.data || {};
  const requiredKeys = ["domain", "access_key_id", "secret_access_key", "session_token", "space_name"];
  for (const key of requiredKeys) {
    if (!creds[key]) {
      throw new Error(`upload_sign missing ${key}: ${JSON.stringify(signData)}`);
    }
  }

  const applyUrl = `https://${creds.domain}/top/v1?` + urlencode({
    Action: "ApplyUploadInner",
    SpaceName: creds.space_name,
    UseQuic: "false",
    Version: "2020-11-19",
    device_platform: "win",
  });
  
  const applyHeaders = vod_signed_headers("GET", applyUrl, "", creds, device);
  const applyResp = await axios.get(applyUrl, { headers: applyHeaders, timeout: 60000 });
  const applyData = applyResp.data;
  
  const node = applyData.Result.InnerUploadAddress.UploadNodes[0];
  const store = node.StoreInfos[0];
  const uploadHost = node.UploadHost;
  const storeUri = store.StoreUri;
  const uploadId = store.UploadID;
  const uploadAuth = store.Auth;
  const vid = node.Vid || (node.Vids || [null])[0];

  const transferUrl = `https://${uploadHost}/upload/v1/${storeUri}?` + urlencode({
    uploadid: uploadId,
    part_number: "0",
    phase: "transfer"
  });
  
  const transferHeaders = upload_binary_headers(uploadAuth, partCrc32, device);
  await axios.post(transferUrl, data, { 
    headers: transferHeaders, 
    timeout: 300000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity
  });

  const finishUrl = `https://${uploadHost}/upload/v1/${storeUri}?` + urlencode({
    uploadmode: "part",
    phase: "finish",
    uploadid: uploadId
  });
  const finishBody = `0:${partCrc32}`;
  const finishHeaders = upload_finish_headers(uploadAuth, device);
  await axios.post(finishUrl, finishBody, { headers: finishHeaders, timeout: 60000 });

  const commitUrl = `https://${creds.domain}/top/v1?` + urlencode({
    Action: "CommitUploadInner",
    SpaceName: creds.space_name,
    Version: "2020-11-19",
    device_platform: "win",
  });
  const commitBody = JSON.stringify({
    Functions: [{ Input: { SnapshotTime: 0.0 }, Name: "Snapshot" }],
    SessionKey: node.SessionKey
  });
  
  const commitHeaders = vod_signed_headers("POST", commitUrl, commitBody, creds, device);
  const commitResp = await axios.post(commitUrl, commitBody, { headers: commitHeaders, timeout: 120000 });
  const commitData = commitResp.data;
  
  const result = commitData.Result.Results[0];
  const meta = result.VideoMeta || {};
  const durationMs = meta.Duration !== undefined ? Math.floor(parseFloat(meta.Duration) * 1000) : 0;
  
  return {
    vid: result.Vid || vid,
    md5: meta.Md5 || localMd5,
    local_md5: localMd5,
    duration_ms: durationMs,
    format: meta.Format,
    size: meta.Size || data.length,
    file_type: meta.FileType,
    store_uri: meta.Uri || storeUri,
  };
}

// ── Build Request ───────────────────────────────────────────────────────────
function build_request(mode, args, device) {
  let pathStr = "";
  let query = {};
  let body = {};
  let appid = false;

  if (mode === "stt-new") {
    if (!args.audio_vid || !args.audio_md5) {
      throw new Error("need --audio-vid and --audio-md5");
    }
    const { babi, body: sttBody } = stt_new_body(
      args.audio_vid,
      args.audio_md5,
      args.duration_ms || 10000,
      args.language || "zh-CN",
      args.translation_language || "vi-VN",
      args.use_translation || false
    );
    pathStr = "/lv/v1/common_task/new";
    query = common_query(device, babi, true);
    body = sttBody;
    appid = false;
  } else if (mode === "stt-query") {
    const reqKey = "cc_audio_subtitle_asr";
    if (!args.task_id || !args.token) {
      throw new Error("need --task-id and --token");
    }
    body = query_body(args.task_id, args.token, reqKey, args.bind_id || "");
    pathStr = "/lv/v1/common_task/query";
    query = common_query(device, null, false);
    appid = false;
  } else {
    throw new Error("bad mode: " + mode);
  }

  const bodyText = JSON.stringify(body);
  const url = BASE + pathStr + "?" + urlencode(query);
  const headers = base_headers(device, bodyText, appid);
  const lowerHeaders = {};
  for (const k of Object.keys(headers)) {
    lowerHeaders[k.toLowerCase()] = headers[k];
  }
  if (!lowerHeaders["sign"]) {
    headers["sign"] = make_sign_header(url, device.appvr, lowerHeaders["device-time"], device.tdid);
  }
  return { url, headers, bodyText };
}

// ── Polling and Transcribing Programmatic interface ──────────────────────────
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function transcribeCapCut(filePath, options = {}) {
  const { 
    language = "zh-CN", 
    translationLanguage = "vi-VN", 
    useTranslation = false, 
    onProgress = () => {},
    device = null,
    returnRaw = false,
    needWordTimestamp = false
  } = options;

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const deviceConfig = { ...createRandomDevice(), ...device };

  onProgress(10, "Uploading audio to CapCut Storage...");
  const uploadInfo = await upload_audio_file(filePath, deviceConfig);
  onProgress(50, `Upload complete. VID: ${uploadInfo.vid}. Submitting ASR task...`);

  const args = {
    audio_vid: uploadInfo.vid,
    audio_md5: uploadInfo.md5,
    duration_ms: uploadInfo.duration_ms || options.durationMs || 10000,
    language,
    translation_language: translationLanguage,
    use_translation: useTranslation
  };

  const { url: newUrl, headers: newHeaders, bodyText: newBody } = build_request("stt-new", args, deviceConfig);
  const submitResp = await axios.post(newUrl, newBody, { headers: newHeaders, timeout: 60000 });
  const submitData = submitResp.data;

  if (submitData.ret !== "0" || !submitData.data) {
    throw new Error(`STT submit API error: ${submitData.errmsg || 'Unknown'}. Full response: ${JSON.stringify(submitData)}`);
  }

  const taskInfo = submitData.data.tasks && submitData.data.tasks[0];
  if (!taskInfo) {
    throw new Error(`STT submit API error: tasks array is empty or missing. Full response: ${JSON.stringify(submitData)}`);
  }
  const taskId = taskInfo.id;
  const token = taskInfo.token;
  const bindId = submitData.data.bind_id || "";

  onProgress(70, `ASR task submitted. Task ID: ${taskId}. Polling for results...`);

  let taskResult = null;
  const reqKey = "cc_audio_subtitle_asr";
  
  for (let attempt = 0; attempt < 100; attempt++) {
    const queryBody = query_body(taskId, token, reqKey, bindId);
    const bodyText = JSON.stringify(queryBody);
    const query = common_query(deviceConfig, null, false);
    const url = BASE + "/lv/v1/common_task/query?" + urlencode(query);
    const headers = base_headers(deviceConfig, bodyText, false);
    const lowerHeaders = {};
    for (const k of Object.keys(headers)) {
      lowerHeaders[k.toLowerCase()] = headers[k];
    }
    if (!lowerHeaders["sign"]) {
      headers["sign"] = make_sign_header(url, deviceConfig.appvr, lowerHeaders["device-time"], deviceConfig.tdid);
    }

    try {
      const queryResp = await axios.post(url, bodyText, { headers, timeout: 60000 });
      const queryJson = queryResp.data;
      if (queryJson.ret === "0" && queryJson.data) {
        const taskInfo = queryJson.data.tasks && queryJson.data.tasks[0];
        if (taskInfo) {
          const resultStr = taskInfo.resp || taskInfo.payload;
          if (resultStr) {
            try {
              const parsedResp = JSON.parse(resultStr);
              if (parsedResp && (parsedResp.utterances || parsedResp.text)) {
                taskResult = parsedResp;
                break;
              }
            } catch (e) {}
          }
          if (taskInfo.status === 4 || taskInfo.status === "4" || taskInfo.status === 5) {
            throw new Error(`ASR task failed on CapCut server (status: ${taskInfo.status})`);
          }
        }
      }
    } catch (err) {
      console.warn(`[CapCut ASR] Polling warning on attempt ${attempt + 1}: ${err.message}`);
    }
    await sleep(5000);
  }

  if (!taskResult) {
    throw new Error("ASR task timed out or returned no results");
  }

  onProgress(100, "ASR Transcription completed successfully!");

  const segments = [];
  if (taskResult.utterances) {
    for (const u of taskResult.utterances) {
      segments.push({
        text: (u.text || "").trim(),
        start_time: u.start_time,
        end_time: u.end_time,
        words: u.words ? u.words.map(w => ({
          text: (w.text || "").trim(),
          start_time: w.start_time,
          end_time: w.end_time
        })) : []
      });
    }
  }

  if (returnRaw) {
    return { segments, raw: taskResult };
  }
  return segments;
}

// ── Subtitle Exporters ──────────────────────────────────────────────────────
function msToSrtTime(ms) {
  const totalSeconds = ms / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.floor(ms % 1000);

  const pad = (num, size) => ('000' + num).slice(-size);
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(milliseconds, 3)}`;
}

function segmentsToSrt(segments) {
  let srtContent = '';
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const start = msToSrtTime(seg.start_time);
    const end = msToSrtTime(seg.end_time);
    srtContent += `${i + 1}\n${start} --> ${end}\n${seg.text}\n\n`;
  }
  return srtContent;
}

function msToAssTime(ms) {
  const totalSeconds = ms / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const centiseconds = Math.floor((ms % 1000) / 10);

  const pad = (num, size) => ('00' + num).slice(-size);
  return `${hours}:${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(centiseconds, 2)}`;
}

function segmentsToAss(segments, options = {}) {
  const {
    fontName = "MicrosoftYaHei-Bold",
    fontSize = 40,
    videoWidth = 1280,
    videoHeight = 720
  } = options;

  const styleStr = 
    "[V4+ Styles]\n" +
    "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour," +
    "Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow," +
    "Alignment,MarginL,MarginR,MarginV,Encoding\n" +
    `Style: Default,${fontName},${fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,2,0,2,10,10,15,1`;

  let assContent = 
    "[Script Info]\n" +
    "; Script generated by independent CapCut ASR tool\n" +
    "ScriptType: v4.00+\n" +
    `PlayResX: ${videoWidth}\n` +
    `PlayResY: ${videoHeight}\n\n` +
    `${styleStr}\n\n` +
    "[Events]\n" +
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n";

  const dialogueTemplate = "Dialogue: 0,{},{},Default,,0,0,0,,{}\n";

  for (const seg of segments) {
    const start = msToAssTime(seg.start_time);
    const end = msToAssTime(seg.end_time);
    const text = seg.text.replace(/\n/g, "\\N");
    
    assContent += dialogueTemplate
      .replace("{}", start)
      .replace("{}", end)
      .replace("{}", text);
  }

  return assContent;
}

module.exports = {
  transcribeCapCut,
  segmentsToSrt,
  segmentsToAss,
  DEFAULT_DEVICE,
  upload_audio_file,
  build_request
};
