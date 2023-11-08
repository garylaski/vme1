function showGraph(num)
{   
    //api call to switch graph
    var graphs = document.getElementsByClassName("graph");
    var graphSelectors = document.getElementsByClassName("graphSelector");
    for (var i = 0; i < graphs.length; ++i)
    {
        graphs[i].style.display = "none";
        graphSelectors[i].style.background = "white"
    }
    
    graphs[num - 1].style.display = "block";
    graphSelectors[num-1].style.background = "lightgrey"
    return false;
}
showGraph(1);
