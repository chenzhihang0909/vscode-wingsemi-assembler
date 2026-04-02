module.exports = {
  // 官方要求：定义样式
  style(vscode) {
    return {
      borderWidth: '1px',
      borderStyle: 'solid',
      backgroundColor: 'rgba(255, 149, 0, 0.2)',
      color: '#ff9500',
      overviewRulerColor: '#ff9500',
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      light: { borderColor: '#ff9500' },
      dark: { borderColor: '#ff9500' },
    };
  },

  // 官方要求：正则匹配代码
  lint(document, rangesToDecorate) {
    // 匹配 C 语言变量 int a = ...
    const regex = /int\s+\w+\s*=/g;
    const text = document.getText();
    let match;

    while ((match = regex.exec(text)) !== null) {
      rangesToDecorate.push({
        range: [match.index, match.index + match[0].length],
        hoverMessage: "周期数: 200 | IPC: 0.489"
      });
    }
  }
};