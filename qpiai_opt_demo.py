from qpiai_opt.opt_modeller import Binary, Model
from qpiai_opt.opt_solvers import solve, Client
import os

api_key = os.environ.get("QPIAI_OPT_API_KEY")

if not api_key:
    raise SystemExit(
        "QPIAI_OPT_API_KEY is missing. Set your QpiAI Opt API key first."
    )

client = Client(api_key=api_key)

# Create binary decision variables
x = Binary("product_A")
y = Binary("product_B")

# Create optimization model
model = Model("quant_a_maze_demo")

# Maximize total score
model.maximize(6 * x + 4 * y)

# Select at most one product
model.add_constraint(x + y <= 1, label="capacity")

# Solve locally
result = solve(model, mode="local", client=client)

print("Problem class:", result.problem_class)
print("Execution mode:", result.execution_mode)
print("Solution:", result.solution)
print("Objective:", result.objective)
print("Solve information:", result.info())
