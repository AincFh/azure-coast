export const districts=[
{id:'marina',name:'蔚蓝码头',en:'AZURE MARINA',kind:'海岸生活',x:19,y:65,desc:'游艇、海滨长廊与日落餐厅交织的城市名片。',color:'#6bc9d7'},
{id:'downtown',name:'中央金融区',en:'DOWNTOWN',kind:'城市核心',x:48,y:35,desc:'玻璃摩天楼、空中花园与全天候商业活动。',color:'#edba80'},
{id:'palms',name:'棕榈大道',en:'PALM BOULEVARD',kind:'潮流商业',x:40,y:66,desc:'设计师店铺、开放式咖啡馆与经典跑车。',color:'#d5b88b'},
{id:'cliff',name:'日光山崖',en:'SUNSET CLIFFS',kind:'山地住宅',x:76,y:23,desc:'盘山公路、现代主义别墅和俯瞰整座城市的观景台。',color:'#b9c6a0'},
{id:'harbor',name:'南港工业区',en:'SOUTH HARBOR',kind:'港口工业',x:72,y:77,desc:'集装箱码头、物流中心和夜间竞速的起点。',color:'#a4b3bd'},
{id:'bay',name:'月牙海湾',en:'CRESCENT BAY',kind:'自然度假',x:16,y:28,desc:'清澈海湾、白沙海滩与水上活动中心。',color:'#8acac0'}];
export const vehicles=[
{id:'solstice',name:'SOLSTICE GT',type:'超跑',price:285000,power:610,top:322,drive:'RWD',color:'#edb677',desc:'自然吸气 V10 与极致车身比例。'},
{id:'vantage',name:'VANTAGE S',type:'轿跑',price:148000,power:440,top:287,drive:'AWD',color:'#8fa4b6',desc:'城市通勤与山路操控之间的平衡。'},
{id:'tide',name:'TIDE E',type:'电动',price:96000,power:520,top:260,drive:'AWD',color:'#88c8bc',desc:'静谧动力，面向海滨都市的未来。'},
{id:'atlas',name:'ATLAS X',type:'SUV',price:119000,power:390,top:238,drive:'AWD',color:'#9c9d8c',desc:'探索郊区与山地的全能伙伴。'},
{id:'retro',name:'RETRO 88',type:'经典',price:72000,power:310,top:245,drive:'RWD',color:'#c99479',desc:'复古车身线条与现代驾驶体验。'},
{id:'comet',name:'COMET R',type:'超跑',price:360000,power:740,top:345,drive:'AWD',color:'#b3b6db',desc:'专为高速直道和竞速挑战而生。'}];
export const homes=[
{id:'villa',name:'海崖全景别墅',district:'日光山崖',price:4250000,beds:5,area:610,tag:'海景独栋'},
{id:'loft',name:'中央云端公寓',district:'中央金融区',price:1680000,beds:3,area:228,tag:'城市天际线'},
{id:'marina-home',name:'游艇港复式',district:'蔚蓝码头',price:2350000,beds:4,area:345,tag:'码头景观'},
{id:'beach',name:'月牙湾度假屋',district:'月牙海湾',price:980000,beds:2,area:175,tag:'海滩步行'},
{id:'palms-home',name:'棕榈大道顶层',district:'棕榈大道',price:1950000,beds:3,area:260,tag:'顶层露台'},
{id:'harbor-home',name:'港湾创意公寓',district:'南港工业区',price:620000,beds:2,area:138,tag:'工业美学'}];
export const missions=[
{id:'sunset',title:'落日试驾',area:'蔚蓝码头',reward:3500,desc:'沿着海岸公路完成一段限时驾驶挑战。'},
{id:'delivery',title:'城市快递',area:'中央金融区',reward:2100,desc:'穿过繁忙的商业街区，准时完成配送。'},
{id:'cliff',title:'山崖巡游',area:'日光山崖',reward:5200,desc:'驾驶至最高观景台，解锁城市全景。'},
{id:'harbor',title:'港口之夜',area:'南港工业区',reward:4300,desc:'熟悉货运码头与工业道路。'}];
export const money=n=>'$'+Number(n).toLocaleString('en-US');
