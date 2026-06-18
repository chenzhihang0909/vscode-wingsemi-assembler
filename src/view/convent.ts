/**
 * 动态解析 Makefile 生成 CMakeLists.txt
 * 自动提取：项目名、编译器、编译选项、头文件、链接配置、源码目录
 * @param {string} makeContent 原始 Makefile 文本
 * @returns {string} 生成的 CMake 内容
 */
function makeToCMake(makeContent:any) {
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

  // 提取源码目录（从 include xxx/subdir.mk）
  const getSrcDirs = () => {
    const reg = /include\s+([\w/]+\/subdir\.mk)/g;
    const dirs = new Set();
    let res;
    while ((res = reg.exec(makeContent))) {
      dirs.add(res[1].replace('/subdir.mk', ''));
    }
    return Array.from(dirs);
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
  ldFlags.forEach((opt: string) => lines.push(`    ${opt}`));
  if (ldScript) lines.push(`    -T ${ldScript}`);
  lines.push(`    -Wl,--no-warn-mismatch`);
  // lines.push(`    -Wl,--gc-sections`);
  lines.push(`)`);
  lines.push('');


  lines.push(`file(GLOB_RECURSE SOURCES`);
  srcDirs.forEach((d: any) => lines.push(`    \${PROJECT_SOURCE_DIR}/${d}/*.[cS]`));
  lines.push(`)`);
  lines.push('');

  lines.push(`add_executable(main \${SOURCES})`);

  return lines.join('\n');
}

export default makeToCMake;