import matplotlib


# Headless backend so this works on servers/CI without a display.
matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
from pathlib import Path


def _out_dir() -> Path:
    out_dir = Path(__file__).resolve().parents[1] / "assets"
    out_dir.mkdir(parents=True, exist_ok=True)
    return out_dir


def _style_axes(ax) -> None:
    ax.grid(True, axis="y", alpha=0.25)
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)


def main() -> int:
    models = ["Rule-Based", "CLIP Retrieval", "LLM Intent Only", "Hybrid Final"]
    accuracy = [0.71, 0.82, 0.79, 0.89]
    precision = [0.69, 0.81, 0.80, 0.90]
    recall = [0.73, 0.83, 0.77, 0.88]
    f1 = [0.71, 0.82, 0.78, 0.89]

    x = np.arange(len(models))
    w = 0.2

    out_dir = _out_dir()

    # 1) Grouped bar chart (already used in README)
    fig1, ax1 = plt.subplots(figsize=(11, 6))
    ax1.bar(x - 1.5 * w, accuracy, width=w, label="Accuracy")
    ax1.bar(x - 0.5 * w, precision, width=w, label="Precision")
    ax1.bar(x + 0.5 * w, recall, width=w, label="Recall")
    ax1.bar(x + 1.5 * w, f1, width=w, label="F1 Score")
    ax1.set_xticks(x, models, rotation=10)
    ax1.set_ylim(0.6, 1.0)
    ax1.set_ylabel("Score")
    ax1.set_title("Model Performance Comparison (Simulated)")
    ax1.legend()
    _style_axes(ax1)
    fig1.tight_layout()
    p1 = out_dir / "model_performance_comparison.png"
    fig1.savefig(p1, dpi=200)
    print(f"Saved: {p1}")

    # 2) Line chart (like your screenshot: Accuracy / Precision / Recall lines)
    fig2, ax2 = plt.subplots(figsize=(11, 5))
    ax2.plot(x, accuracy, marker="o", linewidth=2, label="Accuracy")
    ax2.plot(x, precision, marker="s", linewidth=2, label="Precision")
    ax2.plot(x, recall, marker="^", linewidth=2, label="Recall")
    ax2.set_xticks(x, [str(i + 1) for i in range(len(models))])
    ax2.set_xlim(-0.2, len(models) - 0.8)
    ax2.set_ylim(0.6, 1.0)
    ax2.set_ylabel("Performance Metrics")
    ax2.set_xlabel("Machine Learning Models")
    ax2.set_title("Performance Comparison of Machine Learning Models (Simulated)")
    ax2.legend(loc="center right")
    _style_axes(ax2)
    fig2.tight_layout()
    p2 = out_dir / "model_performance_line.png"
    fig2.savefig(p2, dpi=200)
    print(f"Saved: {p2}")

    # 3) Horizontal bar chart (like your screenshot: model comparison - accuracy)
    order = np.argsort(accuracy)
    sorted_models = [models[i] for i in order]
    sorted_acc = [accuracy[i] for i in order]

    fig3, ax3 = plt.subplots(figsize=(10, 5))
    ax3.barh(sorted_models, sorted_acc)
    ax3.set_xlim(0.6, 1.0)
    ax3.set_xlabel("Accuracy")
    ax3.set_ylabel("Model")
    ax3.set_title("Model Comparison - Accuracy (Simulated)")
    _style_axes(ax3)
    fig3.tight_layout()
    p3 = out_dir / "model_accuracy_barh.png"
    fig3.savefig(p3, dpi=200)
    print(f"Saved: {p3}")

    plt.close("all")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

