package local.operit.claude_code_theme

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.PI

/**
 * 空对话浮层 UI
 * 显示星芒图标 + 时段标语，首条消息时淡出
 */
@Composable
fun EmptyStateOverlay(
    greeting: String,
    visible: Boolean,
    isDark: Boolean,
    onAnimationEnd: () -> Unit
) {
    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(animationSpec = tween(300)),
        exit = fadeOut(animationSpec = tween(1200, easing = EaseOut))
    ) {
        // 全屏容器，点击穿透（不设 clickable）
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                // 星芒图标
                ClaudeLogo(isDark = isDark, size = 80.dp)
                
                Spacer(modifier = Modifier.height(24.dp))
                
                // 标语
                Text(
                    text = greeting,
                    style = TextStyle(
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Normal,
                        color = if (isDark) Color(0xFFE5E5E5) else Color(0xFF2E2E2E),
                        letterSpacing = 0.sp
                    )
                )
            }
        }
    }

    // 监听动画结束
    LaunchedEffect(visible) {
        if (!visible) {
            kotlinx.coroutines.delay(1200)  // 等待淡出动画结束
            onAnimationEnd()
        }
    }
}

/**
 * Claude 星芒图标（几何绘制，8 条射线对称排列）
 */
@Composable
fun ClaudeLogo(isDark: Boolean, size: androidx.compose.ui.unit.Dp) {
    val color = if (isDark) Color(0xFFCC9B7A) else Color(0xFFB87A52)
    
    Canvas(modifier = Modifier.size(size)) {
        val centerX = this.size.width / 2
        val centerY = this.size.height / 2
        val radius = this.size.width / 2
        
        // 8 条射线，每条 45 度间隔
        for (i in 0 until 8) {
            val angle = i * 45.0 * PI / 180.0
            val startRatio = 0.25f  // 内圈起点
            val endRatio = 1.0f     // 外圈终点
            
            val startX = centerX + (radius * startRatio * cos(angle)).toFloat()
            val startY = centerY + (radius * startRatio * sin(angle)).toFloat()
            val endX = centerX + (radius * endRatio * cos(angle)).toFloat()
            val endY = centerY + (radius * endRatio * sin(angle)).toFloat()
            
            // 射线宽度
            val strokeWidth = radius * 0.08f
            
            drawLine(
                color = color,
                start = Offset(startX, startY),
                end = Offset(endX, endY),
                strokeWidth = strokeWidth,
                cap = androidx.compose.ui.graphics.StrokeCap.Round
            )
        }
        
        // 中心圆点
        drawCircle(
            color = color,
            radius = radius * 0.15f,
            center = Offset(centerX, centerY)
        )
    }
}
