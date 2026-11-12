/**
 * TailwindTest - 测试 Tailwind CSS v4 是否正常工作
 */

export function TailwindTest() {
  return (
    <div className="p-4 bg-blue-500 text-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-2">Tailwind CSS v4 测试</h1>
      <p className="text-sm opacity-90">
        如果你看到这个蓝色背景和白色文字，说明 Tailwind CSS v4 已成功集成！
      </p>
      <div className="mt-4 flex gap-2">
        <span className="px-3 py-1 bg-white text-blue-500 rounded-full text-xs font-medium">
          Flex 布局
        </span>
        <span className="px-3 py-1 bg-blue-400 text-white rounded-full text-xs font-medium">
          工具类
        </span>
        <span className="px-3 py-1 bg-blue-300 text-blue-900 rounded-full text-xs font-medium">
          样式生效
        </span>
      </div>
    </div>
  );
}
