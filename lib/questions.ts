// 问卷问题配置
export interface Question {
  id: string;
  type: 'choice' | 'range' | 'multi';
  question: string;
  sub?: string;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export const questions: Question[] = [
  // --- 第一部分：坐标 ---
  {
    id: 'industry',
    type: 'choice',
    question: '第一步，确认你的行业坐标',
    sub: '这决定了你在风暴中的位置。',
    options: [
      '公务员/体制内 (岸上)',
      '新能源/硬科技/出海',
      '互联网/大厂',
      '房地产/建筑/设计',
      '金融/证券/投资',
      '制造业/外贸/实体',
      '餐饮/服务/零售',
      '自由职业/待业'
    ]
  },
  // --- 第二部分：个人实况 (恢复滑块) ---
  {
    id: 'salary_months',
    type: 'range',
    question: '2025年，你个人实际到手了多少个月薪水？',
    sub: '包含年终奖折算。如果是12薪就是12，发不出就是0。',
    min: 0,
    max: 18, 
    step: 0.5,
    unit: '个月'
  },
  {
    id: 'personal_income',
    type: 'choice',
    question: '与去年相比，你个人的年收入变化？',
    sub: '指税后到手总包。',
    options: [
      '逆势增长 (涨幅 > 10%)',
      '基本持平 (波动 < 10%)',
      '温和下跌 (跌幅 10%-30%)',
      '严重下跌 (跌幅 > 30%)',
      '腰斩/失业归零'
    ]
  },
  {
    id: 'personal_arrears',
    type: 'choice',
    question: '你目前遭遇过欠薪吗？',
    sub: '包括绩效被扣、无理由缓发。',
    options: [
      '从未欠薪，按时发放',
      '偶尔延迟，最终发了',
      '正在被拖欠 (3个月以内)',
      '正在被拖欠 (半年以上/无望)'
    ]
  },
  // --- 第三部分：环境侧写 (朋友圈数据) ---
  {
    id: 'friends_status',
    type: 'choice',
    question: '据你观察，你周围亲友/同事的普遍状态是？',
    sub: '旁观者清。谈论别人比谈论自己更客观。',
    options: [
      '普遍在涨薪/跳槽，行情不错',
      '只有极个别能力强的在涨，大部分苟着',
      '大家都在降薪/被裁，怨气很重',
      '都在谈论维权/讨薪，情况恶劣'
    ]
  },
  {
    id: 'friends_arrears_perception',
    type: 'choice',
    question: '在你的社交圈里，"欠薪"这件事...',
    sub: '是一个罕见的词，还是高频词？',
    options: [
      '几乎没听说过 (罕见)',
      '听说过一两个案例 (偶发)',
      '经常听到有人抱怨 (普遍)',
      '几乎各行各业都在发生 (泛滥)'
    ]
  },
  // --- 第四部分：细节 ---
  {
    id: 'welfare_cut',
    type: 'multi',
    question: '最后，今年哪些隐形福利消失了？',
    sub: '多选。如果本来就没有，选"维持原状"。',
    options: [
      '公积金/社保基数调降',
      '年终奖/13薪 消失',
      '加班费/打车餐补 取消',
      '裁员赔偿 N+1 变 N 或更少',
      '没有任何福利缩水/维持原状',
      '福利反而增加了'
    ]
  }
];

