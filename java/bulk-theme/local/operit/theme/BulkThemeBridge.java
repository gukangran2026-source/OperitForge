package local.operit.theme;

import android.content.Context;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * Writes a theme to a card or group that is not the active prompt.
 *
 * commitThemeDraft accepts ActivePrompt, and getActivePrompt returns one of its
 * two nested implementations. Both take a single String id, so a prompt for any
 * role can be built directly instead of using the entity classes, which the
 * ToolPkg bridge cannot type-match against the interface.
 */
public final class BulkThemeBridge {

    private static final long TIMEOUT_MS = 8000L;
    private static final String CARD_PROMPT = "com.ai.assistance.operit.data.model.ActivePrompt$CharacterCard";
    private static final String GROUP_PROMPT = "com.ai.assistance.operit.data.model.ActivePrompt$CharacterGroup";

    private BulkThemeBridge() {
    }

    public static String commitCardTheme(Context ctx, String cardId, Object values) {
        return commit(ctx, CARD_PROMPT, cardId, values);
    }

    public static String commitGroupTheme(Context ctx, String groupId, Object values) {
        return commit(ctx, GROUP_PROMPT, groupId, values);
    }

    private static String commit(Context ctx, String promptClass, String id, Object values) {
        try {
            Object prompt = Class.forName(promptClass).getConstructor(String.class).newInstance(id);
            Object manager = companion(ctx, "com.ai.assistance.operit.data.preferences.ActivePromptManager");
            if (manager == null) {
                return "err:no-manager";
            }
            callSuspend(manager, "commitThemeDraft", new Object[]{prompt, values});
            return "ok";
        } catch (Throwable t) {
            return "err:" + describe(t);
        }
    }

    private static Object companion(Context ctx, String className) throws Exception {
        Class<?> cls = Class.forName(className);
        Object inst = cls.getField("Companion").get(null);
        Method getInstance = inst.getClass().getMethod("getInstance", Context.class);
        return getInstance.invoke(inst, ctx);
    }

    private static Object callSuspend(Object target, String name, Object[] args) throws Exception {
        Method chosen = null;
        for (Method m : target.getClass().getMethods()) {
            if (!m.getName().equals(name)) {
                continue;
            }
            if (m.getParameterCount() != args.length + 1) {
                continue;
            }
            Class<?>[] ps = m.getParameterTypes();
            boolean fits = true;
            for (int i = 0; i < args.length; i++) {
                if (args[i] != null && !ps[i].isInstance(args[i])) {
                    fits = false;
                    break;
                }
            }
            if (fits) {
                chosen = m;
                break;
            }
        }
        if (chosen == null) {
            throw new NoSuchMethodException(name + "/" + args.length);
        }
        CountDownLatch latch = new CountDownLatch(1);
        Object[] holder = new Object[1];
        Object[] full = new Object[args.length + 1];
        System.arraycopy(args, 0, full, 0, args.length);
        full[args.length] = continuation(latch, holder);
        Object immediate = chosen.invoke(target, full);
        if (latch.await(TIMEOUT_MS, TimeUnit.MILLISECONDS)) {
            return holder[0];
        }
        return immediate;
    }

    private static Object continuation(final CountDownLatch latch, final Object[] holder) throws Exception {
        Class<?> cls = Class.forName("kotlin.coroutines.Continuation");
        final Object empty = Class.forName("kotlin.coroutines.EmptyCoroutineContext")
                .getField("INSTANCE").get(null);
        return Proxy.newProxyInstance(cls.getClassLoader(), new Class<?>[]{cls}, new InvocationHandler() {
            @Override
            public Object invoke(Object proxy, Method method, Object[] args) {
                String n = method.getName();
                if ("resumeWith".equals(n)) {
                    holder[0] = (args != null && args.length > 0) ? args[0] : null;
                    latch.countDown();
                    return null;
                }
                if ("getContext".equals(n)) {
                    return empty;
                }
                if ("hashCode".equals(n)) {
                    return System.identityHashCode(proxy);
                }
                if ("equals".equals(n)) {
                    return args != null && args.length > 0 && proxy == args[0];
                }
                if ("toString".equals(n)) {
                    return "BulkThemeContinuation";
                }
                return null;
            }
        });
    }

    private static String describe(Throwable t) {
        Throwable root = t;
        while (root.getCause() != null && root.getCause() != root) {
            root = root.getCause();
        }
        String msg = root.getMessage();
        return root.getClass().getSimpleName() + (msg == null ? "" : (":" + msg));
    }
}