<template>
  <Teleport to="body">
    <div v-if="internalVisible" class="wrapper" @click="handleWrapperClick">
      <slot name="all-content">
        <!-- 默认结构 -->
        <div class="dialog-card" @click.stop>
          <!-- 头部区域 -->
          <div class="dialog-header">
            <div class="dialog-title">{{ title }}</div>
            <button class="dialog-close-button" @click="handleClose">
              &times;
            </button>
          </div>

          <!-- 内容区域：优先显示 content 插槽内容，否则显示 text -->
          <div class="dialog-body">
            <slot name="content">
              <div class="dialog-text">{{ text }}</div>
            </slot>
          </div>

          <!-- 底部按钮区域 -->
          <div class="dialog-footer" v-if="showDefaultButtons">
            <button class="dialog-button cancel" @click="handleCancel">
              {{ cancelText }}
            </button>
            <button class="dialog-button confirm" @click="handleConfirm">
              {{ confirmText }}
            </button>
          </div>
        </div>
      </slot>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

// --- Props 定义 ---
const props = defineProps({
  /**
   * 控制对话框显示/隐藏
   */
  visible: {
    type: Boolean,
    default: false,
  },
  /**
   * 对话框标题 (仅在无 all-content 插槽时有效)
   */
  title: {
    type: String,
    default: "提示",
  },
  /**
   * 对话框中间显示的文本内容 (仅在无 content 插槽时显示)
   */
  text: {
    type: String,
    default: "",
  },
  /**
   * 取消按钮文字 (仅在无 all-content 插槽时有效)
   */
  cancelText: {
    type: String,
    default: "取消",
  },
  /**
   * 确认按钮文字 (仅在无 all-content 插槽时有效)
   */
  confirmText: {
    type: String,
    default: "确定",
  },
  /**
   * 是否显示默认按钮 (取消和确认) (仅在无 all-content 插槽时有效)
   */
  showDefaultButtons: {
    type: Boolean,
    default: true,
  },
  /**
   * 点击遮罩层是否关闭对话框
   */
  closeOnClickModal: {
    type: Boolean,
    default: true,
  },
});

// --- Emits 定义 ---
const emit = defineEmits([
  "update:visible", // 用于 v-model 支持
  "confirm", // 点击确认按钮
  "cancel", // 点击取消按钮或关闭
]);

// --- Refs ---
const internalVisible = ref(props.visible);

// --- Watchers ---
watch(
  () => props.visible,
  (newVal) => {
    internalVisible.value = newVal;
  }
);

// --- Methods ---
const handleClose = () => {
  closeDialog();
  emit("cancel");
};

const handleCancel = () => {
  closeDialog();
  emit("cancel");
};

const handleConfirm = () => {
  emit("confirm");
  // 通常确认后会关闭对话框，除非业务逻辑要求不关闭
  closeDialog();
};

const handleWrapperClick = (event:Event) => {
  if (props.closeOnClickModal && event.target === event.currentTarget) {
    handleClose();
  }
};

const openDialog = () => {
  internalVisible.value = true;
  emit("update:visible", true);
};

const closeDialog = () => {
  internalVisible.value = false;
  emit("update:visible", false);
};

// --- Expose ---
defineExpose({
  openDialog,
  closeDialog,
  open: openDialog,
  close: closeDialog,
});
</script>

<style scoped>
.wrapper {
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1100;
  position: fixed;
  top: 0;
  left: 0;
  background: rgba(84, 84, 84, 0.2);
  backdrop-filter: blur(30px);
}

@keyframes fade-in {
  0% {
    opacity: 0.1;
    transform: scale(0.1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.5);
    transform: translateX(5px);
    transform: translateY(10px);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.dialog-card {
    animation: fade-in 0.4s ease-in-out;
  width: auto;
  min-width: 400px;
  /* height: auto; 让卡片高度自适应内容 */
  background-color: white;
  border-radius: 8px; /* 圆角 */
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); /* 阴影 */
  overflow: hidden; /* 防止圆角切割内容 */
  display: flex;
  flex-direction: column;
}

/* 头部样式 */
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px; /* 内边距 */
  border-bottom: 1px solid #eee; /* 底部分割线 */
}

.dialog-title {
  font-size: 18px;
  font-weight: bold;
  color: #333;
  margin: 0; /* 重置默认外边距 */
}

.dialog-close-button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
  padding: 0; /* 重置默认内边距 */
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%; /* 圆形按钮 */
  transition: background-color 0.2s; /* 悬停过渡 */
}

.dialog-close-button:hover {
  background-color: #f0f0f0; /* 悬停背景色 */
  color: #333; /* 悬停文字颜色 */
}

/* 内容区域样式 */
.dialog-body {
  padding: 20px; /* 内边距 */
  flex-grow: 1; /* 占据剩余空间 */
  overflow-y: auto; /* 如果内容过多，可以滚动 */
}

.dialog-text {
  color: #666;
  line-height: 1.5; /* 行高 */
}

/* 底部按钮区域样式 */
.dialog-footer {
  display: flex;
  justify-content: flex-end; /* 按钮靠右 */
  gap: 10px; /* 按钮间距 */
  padding: 16px 20px; /* 内边距 */
  border-top: 1px solid #eee; /* 顶部分割线 */
}

.dialog-button {
  padding: 8px 16px; /* 按钮内边距 */
  border: 1px solid #ddd; /* 边框 */
  border-radius: 4px; /* 按钮圆角 */
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s; /* 悬停过渡 */
}

.dialog-button.cancel {
  background-color: #fff;
  color: #666;
}

.dialog-button.cancel:hover {
  background-color: #f5f5f5;
}

.dialog-button.confirm {
  background-color: #007bff; /* 主色调 */
  color: white;
  border-color: #007bff; /* 主色调边框 */
}

.dialog-button.confirm:hover {
  background-color: #0056b3; /* 深一点的主色调 */
  border-color: #0056b3;
}
</style>
