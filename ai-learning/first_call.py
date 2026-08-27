from google import genai
from google.genai import types
import pandas as pd


# --------------------------------------------------
# 1. Small dataset
# --------------------------------------------------

df = pd.DataFrame({
    "area": [1200, 1500, 1800, 2200, 2600],
    "price": [250000, 310000, 380000, 470000, 560000],
    "location": ["A", "A", "B", "B", "C"],
})


# --------------------------------------------------
# 2. Tool 1 — column statistics
# --------------------------------------------------

def get_column_statistics(column: str) -> dict:
    if column not in df.columns:
        return {"error": f"Unknown column: {column}"}

    series = df[column]

    result = {
        "column": column,
        "data_type": str(series.dtype),
        "count": int(series.notna().sum()),
        "missing": int(series.isna().sum()),
        "unique_values": int(series.nunique()),
    }

    if pd.api.types.is_numeric_dtype(series):
        result.update({
            "mean": round(float(series.mean()), 4),
            "median": round(float(series.median()), 4),
            "min": round(float(series.min()), 4),
            "max": round(float(series.max()), 4),
        })
    else:
        result["most_common"] = series.mode().iloc[0] if not series.mode().empty else None

    return result


# --------------------------------------------------
# 3. Tool 2 — correlation
# --------------------------------------------------

def calculate_correlation(column_a: str, column_b: str) -> dict:
    if column_a not in df.columns:
        return {"error": f"Unknown column: {column_a}"}

    if column_b not in df.columns:
        return {"error": f"Unknown column: {column_b}"}

    if not pd.api.types.is_numeric_dtype(df[column_a]):
        return {"error": f"{column_a} is not numeric"}

    if not pd.api.types.is_numeric_dtype(df[column_b]):
        return {"error": f"{column_b} is not numeric"}

    correlation = df[column_a].corr(df[column_b])

    return {
        "column_a": column_a,
        "column_b": column_b,
        "correlation": round(float(correlation), 4),
    }


# --------------------------------------------------
# 4. Tool 3 — categorical distribution
# --------------------------------------------------

def get_category_distribution(column: str) -> dict:
    if column not in df.columns:
        return {"error": f"Unknown column: {column}"}

    if pd.api.types.is_numeric_dtype(df[column]):
        return {"error": f"{column} is numeric"}

    counts = df[column].value_counts(dropna=False)

    return {
        "column": column,
        "distribution": {
            str(key): int(value)
            for key, value in counts.items()
        },
    }


# --------------------------------------------------
# 5. Declare all tools
# --------------------------------------------------

tools = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="get_column_statistics",
            description="Get statistics and basic information about one dataset column.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "column": types.Schema(
                        type="STRING",
                        description="Name of the column to inspect.",
                    ),
                },
                required=["column"],
            ),
        ),
        types.FunctionDeclaration(
            name="calculate_correlation",
            description="Calculate Pearson correlation between two numeric columns.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "column_a": types.Schema(type="STRING"),
                    "column_b": types.Schema(type="STRING"),
                },
                required=["column_a", "column_b"],
            ),
        ),
        types.FunctionDeclaration(
            name="get_category_distribution",
            description="Get the frequency distribution of a categorical column.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "column": types.Schema(
                        type="STRING",
                        description="Categorical column to analyze.",
                    ),
                },
                required=["column"],
            ),
        ),
    ]
)


# --------------------------------------------------
# 6. Gemini chat
# --------------------------------------------------

client = genai.Client()

chat = client.chats.create(
    model="gemini-3.1-flash-lite",
    config=types.GenerateContentConfig(
        tools=[tools],
        system_instruction=(
            "You are a data analyst. "
            "Use the available tools whenever you need information "
            "from the dataset. "
            "Do not invent statistics."
        ),
    ),
)


# --------------------------------------------------
# 7. Ask a question
# --------------------------------------------------

question = input("\nAsk a question about the dataset: ")

response = chat.send_message(question)

print("\nFIRST MODEL RESPONSE:")
print(response)


# --------------------------------------------------
# 8. Process tool calls
# --------------------------------------------------

for part in response.candidates[0].content.parts:

    if not part.function_call:
        continue

    function_call = part.function_call

    print("\nTOOL REQUESTED:")
    print(function_call.name)
    print(dict(function_call.args))

    # Execute requested tool
    if function_call.name == "get_column_statistics":
        result = get_column_statistics(
            function_call.args["column"]
        )

    elif function_call.name == "calculate_correlation":
        result = calculate_correlation(
            function_call.args["column_a"],
            function_call.args["column_b"],
        )

    elif function_call.name == "get_category_distribution":
        result = get_category_distribution(
            function_call.args["column"]
        )

    else:
        result = {
            "error": f"Unknown tool: {function_call.name}"
        }

    print("\nTOOL RESULT:")
    print(result)

    # Send result back to Gemini
    tool_response = types.Part.from_function_response(
        name=function_call.name,
        response=result,
    )

    final_response = chat.send_message(tool_response)

    print("\nFINAL ANSWER:")
    print(final_response.text)