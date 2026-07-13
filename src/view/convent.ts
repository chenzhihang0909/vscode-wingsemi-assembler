/**
 * 动态解析 Makefile 生成 CMakeLists.txt
 * 自动提取：项目名、编译器、编译选项、头文件、链接配置、源码目录
 * @param {string} makeContent 原始 Makefile 文本
 * @param {object} objsJsonContent OBJS.json 解析后的JSON对象，包含OBJS数组
 * @returns {string} 生成的 CMake 内容
 */
function makeToCMake(makeContent: string, objsJsonContent: any) {
  // 提取项目名 (Target project: xxx)
  const getProjectName = () => {
    const m = makeContent.match(/Target project:\s*(\w+)/);
    return m ? m[1].trim() : 'project';
  };

  // 提取编译器路径
  const getCC = () => {
    const m = makeContent.match(/CC\s*=\s*([^\n#]+)/);
    return m ? m[1].trim() : '';
  };

  // 提取编译参数 CFLAGS，过滤 -MMD -MP
  const getCFlags = () => {
    const m = makeContent.match(/CFLAGS\s*=\s*([\s\S]*?)(?=\n#|\nINCLUDES|\nLDFLAGS|\n\$\(OUTPUT_DIR\))/);
    if (!m) return [];
    return m[1]
      .replace(/\\\n/g, ' ')
      .split(/\s+/)
      .filter((s: string) => s && s !== '-MMD' && s !== '-MP');
  };

  // 提取所有 -I 头文件路径
  const getIncludes = () => {
    const m = makeContent.match(/INCLUDES\s*=\s*([\s\S]*?)(?=\n#|\nCFLAGS|\nLDFLAGS|\n\$\(OUTPUT_DIR\))/);
    if (!m) return [];
    const paths = [];
    const reg = /-I\s*([^\s\\]+)/g;
    let res;
    while ((res = reg.exec(m[1]))) {
      paths.push(res[1].trim());
    }
    return paths;
  };

  // 提取链接参数、链接脚本、库目录
  const getLdInfo = (): { ldFlags: string[]; ldScript: string; libDir: string } => {
    const m = makeContent.match(/LDFLAGS\s*=\s*([\s\S]*?)(?=\n#|\nall:|\n\$\(TARGET\))/);
    const ret: { ldFlags: string[]; ldScript: string; libDir: string } = { ldFlags: [], ldScript: '', libDir: '' };
    if (!m) return ret;
    const parts = m[1].replace(/\\\n/g, ' ').split(/\s+/).filter(Boolean);
    let idx = 0;
    while (idx < parts.length) {
      const cur = parts[idx];
      if (cur === '-L' && idx + 1 < parts.length) {
        ret.libDir = parts[++idx];
      } else if (cur === '-T' && idx + 1 < parts.length) {
        ret.ldScript = parts[++idx];
      } else {
        ret.ldFlags.push(cur);
      }
      idx++;
    }
    return ret;
  };

  // 【重写】从 OBJS.json 的 .o 文件路径解析源码目录
  const getSrcDirs = () => {
    const objList = objsJsonContent?.OBJS ?? [];
    const dirSet = new Set<string>();

    for (const objPath of objList) {
      // 示例路径：/xxx/demo_130C/output/Application/main.o
      // 1. 分割路径，去掉文件名 main.o
      const pathParts = objPath.split('/');
      pathParts.pop(); // 删除 .o 文件名
      const objDir = pathParts.join('/');

      // 2. 剔除 output 输出目录，得到源码根目录（output 是编译输出，源码在上一级）
      const outputMarker = '/output/';
      const outputPos = objDir.indexOf(outputMarker);
      if (outputPos === -1) continue;

      // 截取 output 前面的项目根 + output后一级目录
      const srcDirRaw = objDir.slice(outputPos + outputMarker.length);
      if (!srcDirRaw) continue;

      dirSet.add(srcDirRaw);
    }

    return Array.from(dirSet);
  };

  // 统一提取所有动态变量
  const projectName = getProjectName();
  const ccPath = getCC();
  const cFlags = getCFlags();
  const incPaths = getIncludes();
  const { ldFlags, ldScript, libDir } = getLdInfo();
  const srcDirs = getSrcDirs();

  // 拼接 CMake 文本
  const lines = [];

  lines.push(`set(CMAKE_C_COMPILER_WORKS ON CACHE BOOL "" FORCE)`);
  lines.push(`set(CMAKE_C_COMPILER_FORCED ON)`);
  lines.push(`set(CMAKE_ASM_COMPILER_FORCED ON)`);
  lines.push('');

  lines.push(`set(CMAKE_C_COMPILER ${ccPath})`);
  lines.push(`set(CMAKE_ASM_COMPILER ${ccPath})`);
  lines.push('');

  // 项目名动态赋值
  lines.push(`cmake_minimum_required(VERSION 3.10)`);
  lines.push(`project(${projectName} C ASM)`);
  lines.push(`enable_language(ASM)`);
  lines.push('');

  lines.push(`add_compile_options(`);
  cFlags.forEach((opt: string) => lines.push(`    ${opt}`));
  lines.push(`)`);
  lines.push('');

  lines.push(`include_directories(`);
  incPaths.forEach((p: string) => lines.push(`    ${p}`));
  lines.push(`)`);
  lines.push('');

  if (libDir) {
    lines.push(`link_directories(${libDir})`);
    lines.push('');
  }

  lines.push(`add_link_options(`);
  ldFlags.forEach((opt: string) => opt.indexOf('--gc-sections') === -1 && lines.push(`    ${opt}`));
  if (ldScript) lines.push(`    -T ${ldScript}`);
  lines.push(`    -Wl,--no-warn-mismatch`);
  // lines.push(`    -Wl,--gc-sections`);
  lines.push(`)`);
  lines.push('');

  lines.push(`file(GLOB_RECURSE SOURCES`);
  srcDirs.forEach((d: string) => lines.push(`    \${PROJECT_SOURCE_DIR}/${d}/*.[cS]`));
  lines.push(`)`);
  lines.push('');

  lines.push(`add_executable(main \${SOURCES})`);

  return lines.join('\n');
}

export default makeToCMake;