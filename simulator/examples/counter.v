module counter #(
    parameter WIDTH = 4
) (
    input  wire            clk,
    input  wire            reset,
    output reg [WIDTH-1:0] count
);

    always @(posedge clk) begin
        if (reset)
            count <= 0;
        else
            count <= count + 1'b1;
    end

endmodule