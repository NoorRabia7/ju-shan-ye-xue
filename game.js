// 全局变量
let db;
let currentChapter = 1;
let currentScene = 0;
let stats = {
    "隐忍": { current: 10, max: 10, min: 10 },
    "威望": { current: 10, max: 10, min: 10 },
    "健康": { current: 10, max: 10, min: 10 },
    "刘信好感": { current: 10, max: 10, min: 10 },
    "徐湛好感": { current: 10, max: 10, min: 10 },
    "春雨长乐好感": { current: 10, max: 10, min: 10 }
};

// 初始化数据库
async function initDB() {
    const response = await fetch('game_data.db');
    const arrayBuffer = await response.arrayBuffer();
    const SQL = await initSqlJs({ locateFile: () => 'sql-wasm.wasm' });
    db = new SQL.Database(new Uint8Array(arrayBuffer));
    startGame();
}

// 开始游戏
function startGame() {
    loadChapter(currentChapter);
}

// 加载章节
function loadChapter(chapterId) {
    const chapter = db.exec(`SELECT * FROM Chapters WHERE chapter_id = ${chapterId}`)[0];
    document.getElementById('chapter-title').innerText = chapter.values[0][1];
    currentScene = 0;
    loadScene(chapterId);
}

// 加载场景
function loadScene(chapterId) {
    if (chapterId === 8) {
        showEnding();
        return;
    }
    const scenes = db.exec(`SELECT * FROM Scenes WHERE chapter_id = ${chapterId} ORDER BY scene_order`);
    if (!scenes || !scenes[0] || currentScene >= scenes[0].values.length) {
        if (chapterId < 8) {
            updateStatsAtChapterEnd();
            currentChapter++;
            loadChapter(currentChapter);
        }
        return;
    }

    const scene = scenes[0].values[currentScene];
    let sceneText = scene[2];
    const sceneId = scene[0];
    console.log(`当前场景: chapter=${chapterId}, scene_id=${sceneId}, text=${sceneText}`);

    const toneMatches = sceneText.match(/\[动态语气：(.+?)\]/g);
    if (toneMatches) {
        toneMatches.forEach(match => {
            const characterName = match.match(/\[动态语气：(.+?)\]/)[1];
            const tone = getDynamicTone(sceneId, characterName);
            sceneText = sceneText.replace(match, tone);
        });
    }

    document.getElementById('scene-text').innerText = sceneText;
    document.getElementById('next-btn').style.display = scene[5] ? 'none' : 'block';
    updateStatsDisplay();

    const optionsDiv = document.getElementById('options');
    optionsDiv.innerHTML = '';
    if (scene[5]) {
        const options = db.exec(`SELECT * FROM Options WHERE interaction_id = ${scene[5]} ORDER BY option_order`)[0];
        options.values.forEach(option => {
            const btn = document.createElement('button');
            btn.innerText = option[2];
            btn.onclick = () => handleOption(option[0]);
            optionsDiv.appendChild(btn);
        });
    }
}

// 获取动态语气
function getDynamicTone(sceneId, characterName) {
    const tones = db.exec(`SELECT * FROM Dynamic_Tones WHERE scene_id = ${sceneId} AND character_name = '${characterName}'`)[0];
    if (!tones || !tones.values) {
        console.log(`未找到 ${characterName} 在 scene_id=${sceneId} 的动态语气`);
        return '';
    }
    const statKey = characterName === "徐湛" ? "徐湛好感" : characterName === "刘信" ? "刘信好感" : "春雨长乐好感";
    const level = getStatLevel(stats[statKey]);
    const tone = tones.values.find(t => t[3] === level);
    return tone ? tone[4] : tones.values[0][4];
}

// 处理选项
function handleOption(optionId) {
    const changes = db.exec(`SELECT * FROM Attribute_Changes WHERE option_id = ${optionId}`)[0];
    console.log(`optionId=${optionId}, changes=`, changes);
    if (changes && changes.values) {
        changes.values.forEach(change => {
            const attr = change[2];
            const value = Number(change[3]);
            console.log(`attr=${attr}, value=${value}, typeof value=${typeof value}`);
            if (stats[attr]) {
                stats[attr].current += value;
                console.log(`更新 ${attr}: ${stats[attr].current}`);
                const options = db.exec(`SELECT * FROM Options WHERE interaction_id = (SELECT interaction_id FROM Attribute_Changes WHERE option_id = ${optionId})`)[0];
                let maxChange = 0, minChange = Infinity;
                options.values.forEach(opt => {
                    const optChanges = db.exec(`SELECT * FROM Attribute_Changes WHERE option_id = ${opt[0]} AND attribute_name = '${attr}'`)[0];
                    if (optChanges) {
                        const val = Number(optChanges.values[0][3]);
                        maxChange = Math.max(maxChange, val);
                        minChange = Math.min(minChange, val);
                    }
                });
                stats[attr].max += maxChange;
                stats[attr].min += minChange;
            } else {
                console.log(`属性 ${attr} 不存在`);
            }
        });
    } else {
        console.log(`没有找到 option_id=${optionId} 的变化`);
    }
    nextScene();
}

// 下一页
function nextScene() {
    currentScene++;
    loadScene(currentChapter);
}

// 章节结束数值更新
function updateStatsAtChapterEnd() {
    if (getStatLevel(stats["隐忍"]) === "高") {
        stats["徐湛好感"].current += Math.round(stats["徐湛好感"].current * 0.05);
        stats["刘信好感"].current += Math.round(stats["刘信好感"].current * 0.05);
    }
    let prestigeLevel = getStatLevel(stats["威望"]);
    if (prestigeLevel === "高") {
        stats["徐湛好感"].current -= Math.round(stats["徐湛好感"].current * 0.05);
        stats["刘信好感"].current -= Math.round(stats["刘信好感"].current * 0.05);
        stats["春雨长乐好感"].current += Math.round(stats["春雨长乐好感"].current * 0.03);
    } else if (prestigeLevel === "中") {
        stats["徐湛好感"].current -= Math.round(stats["徐湛好感"].current * 0.02);
        stats["刘信好感"].current -= Math.round(stats["刘信好感"].current * 0.02);
    }
    if (getStatLevel(stats["刘信好感"]) === "高") {
        stats["健康"].current += Math.round(stats["健康"].current * 0.03);
    }
    if (getStatLevel(stats["徐湛好感"]) === "高") {
        stats["健康"].current += Math.round(stats["健康"].current * 0.01);
    }
    if (getStatLevel(stats["春雨长乐好感"]) === "高") {
        stats["健康"].current += Math.round(stats["健康"].current * 0.05);
    }
    for (let key in stats) {
        stats[key].current = Math.max(stats[key].min, Math.min(stats[key].max, stats[key].current));
    }
}

// 获取状态
function getStatLevel(stat) {
    let range = stat.max - stat.min;
    let lowThreshold = stat.min + range * 0.54;
    let highThreshold = stat.max - range * 0.43;
    if (stat.current <= lowThreshold) return "低";
    if (stat.current >= highThreshold) return "高";
    return "中";
}

// 显示结局
function showEnding() {
    const chapter = db.exec(`SELECT * FROM Chapters WHERE chapter_id = 8`)[0];
    document.getElementById('chapter-title').innerText = chapter ? chapter.values[0][1] : "结局";
    const fame = getStatLevel(stats["威望"]);
    const tough = getStatLevel(stats["隐忍"]);
    const favor = getStatLevel(stats["徐湛好感"]);
    let endingId;

    if ((fame === "高" && tough === "低" && favor === "低") ||
        (fame === "高" && tough === "中" && favor === "低") ||
        (fame === "中" && tough === "低" && favor === "低") ||
        (fame === "低" && tough === "低" && favor === "低") ||
        (fame === "低" && tough === "高" && favor === "低")) {
        endingId = 1;
    } else if ((fame === "高" && tough === "高" && favor === "低") ||
               (fame === "中" && tough === "高" && favor === "低") ||
               (fame === "中" && tough === "中" && favor === "低") ||
               (fame === "低" && tough === "中" && favor === "低") ||
               (fame === "低" && tough === "高" && favor === "中") ||
               (fame === "低" && tough === "中" && favor === "中")) {
        endingId = 2;
    } else if ((fame === "高" && tough === "高" && favor === "中") ||
               (fame === "高" && tough === "中" && favor === "中") ||
               (fame === "中" && tough === "高" && favor === "高") ||
               (fame === "中" && tough === "高" && favor === "中") ||
               (fame === "中" && tough === "中" && favor === "中") ||
               (fame === "低" && tough === "低" && favor === "中") ||
               (fame === "中" && tough === "低" && favor === "中") ||
               (fame === "低" && tough === "高" && favor === "高") ||
               (fame === "低" && tough === "中" && favor === "高") ||
               (fame === "低" && tough === "低" && favor === "高")) {
        endingId = 3;
    } else if ((fame === "高" && tough === "高" && favor === "高") ||
               (fame === "高" && tough === "中" && favor === "高") ||
               (fame === "高" && tough === "低" && favor === "高") ||
               (fame === "高" && tough === "低" && favor === "中") ||
               (fame === "中" && tough === "低" && favor === "高") ||
               (fame === "中" && tough === "中" && favor === "高")) {
        endingId = 4;
    }

    let endingText;
    try {
        endingText = db.exec(`SELECT ending_text FROM Endings WHERE ending_id = ${endingId}`)[0].values[0][0];
    } catch (e) {
        endingText = "结局加载失败，请检查数据库！";
    }
    document.getElementById('scene-text').innerText = endingText;
    document.getElementById('options').innerHTML = '';
    document.getElementById('next-btn').style.display = 'none';
    updateStatsDisplay();
}

// 更新数值显示
function updateStatsDisplay() {
    const statsDiv = document.getElementById('stats-display');
    statsDiv.innerHTML = `
        隐忍: ${stats["隐忍"].current} (范围: ${stats["隐忍"].min} - ${stats["隐忍"].max}, 级别: ${getStatLevel(stats["隐忍"])})<br>
        威望: ${stats["威望"].current} (范围: ${stats["威望"].min} - ${stats["威望"].max}, 级别: ${getStatLevel(stats["威望"])})<br>
        健康: ${stats["健康"].current} (范围: ${stats["健康"].min} - ${stats["健康"].max}, 级别: ${getStatLevel(stats["健康"])})<br>
        刘信好感: ${stats["刘信好感"].current} (范围: ${stats["刘信好感"].min} - ${stats["刘信好感"].max}, 级别: ${getStatLevel(stats["刘信好感"])})<br>
        徐湛好感: ${stats["徐湛好感"].current} (范围: ${stats["徐湛好感"].min} - ${stats["徐湛好感"].max}, 级别: ${getStatLevel(stats["徐湛好感"])})<br>
        春雨长乐好感: ${stats["春雨长乐好感"].current} (范围: ${stats["春雨长乐好感"].min} - ${stats["春雨长乐好感"].max}, 级别: ${getStatLevel(stats["春雨长乐好感"])})
    `;
}

// 启动
initDB();